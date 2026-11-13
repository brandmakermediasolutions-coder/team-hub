import { createClient } from '@supabase/supabase-js'
import { addDays } from './date'

/*
  Shared database (Supabase). When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set,
  everyone reads and writes the same data and sees changes live. Without them the app runs
  in "demo mode" and keeps data in this browser only.
*/

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloud = Boolean(url && key)
export const supabase = isCloud ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export const TABLES = ['employees', 'clients', 'tasks', 'comments', 'updates', 'posts', 'activity', 'repeat_rules', 'task_templates', 'repeat_runs']

// app data key -> database table, where the names differ
const TABLE_OF = { rules: 'repeat_rules', templates: 'task_templates', repeatRuns: 'repeat_runs' }
const KEY_OF = Object.fromEntries(Object.entries(TABLE_OF).map(([k, t]) => [t, k]))
const tableOf = (key) => TABLE_OF[key] ?? key

const snake = (s) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
export const toDb = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v === undefined ? null : v]))
export const fromDb = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [camel(k), v]))

// Supabase returns at most 1000 rows per request, so page through.
async function fetchAll(table, filter) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*')
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw error
    out.push(...data.map(fromDb))
    if (data.length < 1000) return out
  }
}

export async function loadAll() {
  const [employees, clients, tasks, comments, updates, posts, activity] = await Promise.all([
    fetchAll('employees'),
    fetchAll('clients'),
    fetchAll('tasks'),
    fetchAll('comments'),
    fetchAll('updates', (q) => q.gte('date', addDays(-90))),
    fetchAll('posts', (q) => q.gte('date', addDays(-150))),
    fetchAll('activity', (q) => q.order('at', { ascending: false }).limit(500)),
  ])
  // newer tables: if the 2026-11-13 migration has not been run yet, the rest of the app still loads
  const optional = (p) => p.catch((e) => { console.warn('Team Hub: optional table not ready', e?.message ?? e); return [] })
  const [rules, templates, repeatRuns] = await Promise.all([
    optional(fetchAll('repeat_rules')),
    optional(fetchAll('task_templates')),
    optional(fetchAll('repeat_runs', (q) => q.gte('at', Date.now() - 45 * 86400000))),
  ])
  return { employees, clients, tasks, comments, updates, posts, activity, rules, templates, repeatRuns }
}

export async function saveRow(table, row) {
  const { error } = await supabase.from(tableOf(table)).upsert(toDb(row))
  if (error) throw error
}

// insert, and quietly skip rows whose id already exists (repeating tasks: safe if two people load at once)
export async function insertMissing(table, rows) {
  if (!rows.length) return
  const { error } = await supabase.from(tableOf(table)).upsert(rows.map(toDb), { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

// away dates: a database function checks it is you, your head, or the admin
export async function saveAway(id, { awayFrom, awayTo, awayNote }) {
  const { error } = await supabase.rpc('set_away', { target: id, from_date: awayFrom || null, to_date: awayTo || null, note: awayNote ?? '' })
  if (error) throw error
}

export async function saveRows(table, rows) {
  if (!rows.length) return
  const { error } = await supabase.from(table).insert(rows.map(toDb))
  if (error) throw error
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(tableOf(table)).delete().eq('id', id)
  if (error) throw error
}

// Live changes from other people. onChange(table, 'INSERT' | 'UPDATE' | 'DELETE', row)
export function subscribe(onChange) {
  const ch = supabase.channel('team-hub-live')
  TABLES.forEach((table) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
      onChange(KEY_OF[table] ?? table, p.eventType, p.eventType === 'DELETE' ? fromDb(p.old) : fromDb(p.new))
    })
  })
  ch.subscribe()
  return () => supabase.removeChannel(ch)
}

// Full-history search of daily updates (older than what is loaded on screen).
export async function searchUpdates(term) {
  const { data, error } = await supabase.from('updates').select('*').ilike('text', `%${term}%`).order('date', { ascending: false }).limit(60)
  if (error) throw error
  return data.map(fromDb)
}
