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

export const TABLES = ['employees', 'clients', 'tasks', 'comments', 'updates', 'posts', 'activity']

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
  return { employees, clients, tasks, comments, updates, posts, activity }
}

export async function saveRow(table, row) {
  const { error } = await supabase.from(table).upsert(toDb(row))
  if (error) throw error
}

export async function saveRows(table, rows) {
  if (!rows.length) return
  const { error } = await supabase.from(table).insert(rows.map(toDb))
  if (error) throw error
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

// Live changes from other people. onChange(table, 'INSERT' | 'UPDATE' | 'DELETE', row)
export function subscribe(onChange) {
  const ch = supabase.channel('team-hub-live')
  TABLES.forEach((table) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
      onChange(table, p.eventType, p.eventType === 'DELETE' ? fromDb(p.old) : fromDb(p.new))
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
