import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, STATUSES } from './seed'
import { isCloud, supabase, loadAll, saveRow, deleteRow, subscribe, insertMissing, saveAway } from '../lib/backend'
import { shortDate, todayIso } from '../lib/date'
import { dueRepeats, reviewerFor } from '../lib/repeat'

/*
  One app store.
  DATA     employees, clients, tasks, comments, updates (daily updates), posts (post calendar), activity,
           rules (repeating tasks), templates (task templates), repeatRuns (repeating tasks already made)
  SESSION  phase: 'loading' | 'login' | 'recovery' | 'not-on-team' | 'error' | 'ready'
           currentUserId, theme, lastSeen{userId: ts}
  UI       openTaskId (task drawer), newTask (null | defaults for the New task window), toast

  Every change is applied on screen first, then saved to the shared database (cloud mode).
  In demo mode everything is kept in this browser's storage.
*/

const DATA_KEYS = ['employees', 'clients', 'tasks', 'comments', 'updates', 'posts', 'activity', 'rules', 'templates', 'repeatRuns']
const empty = Object.fromEntries(DATA_KEYS.map((k) => [k, []]))
const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
const nextId = (list, prefix, pad) => {
  const max = list.reduce((m, x) => Math.max(m, parseInt(String(x.id).split('-')[1], 10) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}
const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id
const firstName = (e) => e?.name?.split(' ')[0] ?? 'someone'
let unsubscribe = null

export const useStore = create(
  persist(
    (set, get) => {
      // ---------- low-level write helpers ----------
      const upsertLocal = (table, row) => set((s) => {
        const list = s[table]
        const i = list.findIndex((x) => x.id === row.id)
        return { [table]: i === -1 ? [row, ...list] : list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) }
      })
      const removeLocal = (table, id) => set((s) => ({ [table]: s[table].filter((x) => x.id !== id) }))
      const failed = (err) => {
        console.error(err)
        get().showToast('Could not save. Check your internet and try again.', 'error')
        if (isCloud) get().reload()
      }
      const put = (table, row) => {
        upsertLocal(table, row)
        if (isCloud) saveRow(table, row).catch(failed)
      }
      const del = (table, id) => {
        removeLocal(table, id)
        if (isCloud) deleteRow(table, id).catch(failed)
      }
      const log = (entry) => put('activity', { id: uid('A'), at: Date.now(), actorId: get().currentUserId, taskId: null, clientId: null, targetId: null, ...entry })
      const emp = (id) => get().employees.find((e) => e.id === id)

      const startCloud = async (email) => {
        set({ phase: 'loading' })
        try {
          const data = await loadAll()
          const me = data.employees.find((e) => e.active && e.email && e.email.toLowerCase() === email.toLowerCase())
          if (!me) { set({ ...empty, phase: 'not-on-team', authEmail: email }); return }
          set({ ...data, currentUserId: me.id, authEmail: email, phase: 'ready' })
          unsubscribe?.()
          unsubscribe = subscribe((table, type, row) => (type === 'DELETE' ? removeLocal(table, row.id) : upsertLocal(table, row)))
        } catch (e) {
          console.error(e)
          set({ phase: 'error', authEmail: email })
        }
      }

      return {
        ...(isCloud ? empty : buildSeed()),
        phase: isCloud ? 'loading' : 'login',
        currentUserId: null,
        authEmail: null,
        theme: 'light',
        lastSeen: {},
        openTaskId: null,
        newTask: null,
        toast: null,

        showToast: (message, tone = 'ok') => {
          const id = Date.now()
          set({ toast: { id, message, tone } })
          setTimeout(() => get().toast?.id === id && set({ toast: null }), 3200)
        },

        // ---------- session ----------
        init: async () => {
          if (!isCloud) { set({ phase: get().currentUserId ? 'ready' : 'login' }); return }
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') set({ phase: 'recovery' })
            else if (event === 'SIGNED_OUT') { unsubscribe?.(); set({ ...empty, currentUserId: null, phase: 'login' }) }
            else if (event === 'SIGNED_IN' && session && get().phase !== 'ready' && get().phase !== 'recovery') startCloud(session.user.email)
          })
          const { data } = await supabase.auth.getSession()
          if (get().phase === 'recovery') return
          if (data.session) startCloud(data.session.user.email)
          else set({ phase: 'login' })
        },
        reload: () => { const e = get().authEmail; if (isCloud && e) startCloud(e) },

        // demo mode: pick a person
        demoLogin: (id) => set({ currentUserId: id, phase: 'ready', openTaskId: null, newTask: null }),

        // cloud mode
        signIn: async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
          return error ? { ok: false, error: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message } : { ok: true }
        },
        signUp: async (email, password) => {
          const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
          if (error) {
            const notOnTeam = /not on the team hub list|database error/i.test(error.message)
            return { ok: false, error: notOnTeam ? 'This email is not on the team list. Ask Bidhan to add it in Admin → People.' : error.message }
          }
          return { ok: true, needsConfirm: !data.session }
        },
        sendReset: async (email) => {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
          return error ? { ok: false, error: error.message } : { ok: true }
        },
        setNewPassword: async (password) => {
          const { data, error } = await supabase.auth.updateUser({ password })
          if (error) return { ok: false, error: error.message }
          startCloud(data.user.email)
          return { ok: true }
        },
        logout: async () => {
          set({ openTaskId: null, newTask: null })
          if (isCloud) await supabase.auth.signOut()
          else set({ currentUserId: null, phase: 'login' })
        },

        toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
        markSeen: () => set((s) => ({ lastSeen: { ...s.lastSeen, [s.currentUserId]: Date.now() } })),

        // ---------- ui ----------
        openTask: (id) => set({ openTaskId: id }),
        closeTask: () => set({ openTaskId: null }),
        openNewTask: (defaults = {}) => set({ newTask: defaults }),
        closeNewTask: () => set({ newTask: null }),

        // ---------- tasks ----------
        createTask: (data) => {
          const s = get()
          const task = {
            id: uid('T'), title: data.title.trim(), clientId: data.clientId || null,
            assigneeId: data.assigneeId || s.currentUserId, assignedById: s.currentUserId,
            due: data.due || null, status: 'todo', urgent: !!data.urgent, notes: data.notes?.trim() ?? '', links: [],
            createdAt: Date.now(), updatedAt: Date.now(), completedAt: null,
          }
          put('tasks', task)
          const self = task.assigneeId === s.currentUserId
          log({ type: 'assigned', taskId: task.id, clientId: task.clientId, targetId: task.assigneeId,
            text: self ? `added "${task.title}"` : `assigned "${task.title}" to ${firstName(emp(task.assigneeId))}` })
          return task
        },

        updateTask: (id, patch) => {
          const s = get()
          const old = s.tasks.find((t) => t.id === id)
          if (!old) return
          const next = { ...old, ...patch, updatedAt: Date.now() }
          const base = { taskId: id, clientId: next.clientId }
          const notify = s.currentUserId === next.assigneeId ? next.assignedById : next.assigneeId
          const moved = patch.status && patch.status !== old.status
          if (moved) {
            next.completedAt = patch.status === 'done' ? Date.now() : null
            // review step: pick who checks it (giver if a head/admin, else the doer's head)
            if (patch.status === 'review') next.reviewerId = reviewerFor(next, s.employees)
          }
          put('tasks', next)
          if (moved && patch.status === 'review') {
            log({ ...base, type: 'review', targetId: next.reviewerId, text: `sent "${next.title}" for review` })
          } else if (moved && old.status === 'review' && patch.status === 'done' && s.currentUserId !== next.assigneeId) {
            log({ ...base, type: 'status', targetId: next.assigneeId, text: `approved "${next.title}"` })
          } else if (moved) {
            log({ ...base, type: 'status', targetId: notify,
              text: patch.status === 'done' ? `completed "${next.title}"` : `moved "${next.title}" to ${statusLabel(patch.status)}` })
          }
          if (patch.assigneeId && patch.assigneeId !== old.assigneeId) {
            log({ ...base, type: 'assigned', targetId: patch.assigneeId,
              text: `gave "${next.title}" to ${firstName(emp(patch.assigneeId))} (was ${firstName(emp(old.assigneeId))})` })
          }
          if ('due' in patch && patch.due !== old.due) log({ ...base, type: 'edit', targetId: notify, text: `changed the due date of "${next.title}"` })
        },

        // review step: back to Doing, with an optional one-line note saved as a comment
        sendBack: (id, note = '') => {
          const s = get()
          const old = s.tasks.find((t) => t.id === id)
          if (!old) return
          put('tasks', { ...old, status: 'doing', completedAt: null, updatedAt: Date.now() })
          const body = note.trim()
          if (body) put('comments', { id: uid('CM'), taskId: id, authorId: s.currentUserId, text: body, at: Date.now() })
          log({ type: 'status', taskId: id, clientId: old.clientId, targetId: old.assigneeId,
            text: `sent "${old.title}" back${body ? `: ${body}` : ''}` })
        },

        // ---------- repeating tasks ----------
        // Makes any repeating task that is due to exist and doesn't yet. Safe to call often.
        runRepeats: () => {
          const s = get()
          if (s.phase !== 'ready' || !s.currentUserId || !s.rules?.length) return
          const made = new Set([...s.tasks.map((t) => t.id), ...s.repeatRuns.map((r) => r.id)])
          const fresh = dueRepeats(s.rules, s.clients, s.employees, todayIso()).filter((t) => !made.has(t.id))
          if (!fresh.length) return
          const runs = fresh.map((t) => ({ id: t.id, ruleId: t.repeatRuleId, at: Date.now() }))
          set((x) => ({ tasks: [...fresh, ...x.tasks], repeatRuns: [...runs, ...x.repeatRuns] }))
          if (isCloud) insertMissing('tasks', fresh).then(() => insertMissing('repeatRuns', runs)).catch((e) => console.error('Repeating tasks not saved', e))
        },
        saveRule: (rule) => put('rules', { id: rule.id ?? uid('R'), createdAt: Date.now(), active: true, ...rule }),
        deleteRule: (id) => del('rules', id),

        // ---------- templates ----------
        saveTemplate: (tpl) => put('templates', { id: tpl.id ?? uid('TPL'), createdAt: Date.now(), ...tpl }),
        deleteTemplate: (id) => del('templates', id),

        // ---------- on leave ----------
        setAway: (id, { awayFrom, awayTo, awayNote = '' }) => {
          const s = get()
          const e = s.employees.find((x) => x.id === id)
          if (!e) return
          const clear = !awayFrom || !awayTo
          const patch = clear ? { awayFrom: null, awayTo: null, awayNote: '' }
            : { awayFrom: awayFrom <= awayTo ? awayFrom : awayTo, awayTo: awayFrom <= awayTo ? awayTo : awayFrom, awayNote: awayNote.trim() }
          upsertLocal('employees', { ...e, ...patch })
          if (isCloud) saveAway(id, patch).catch(failed)
          if (id !== s.currentUserId) {
            log({ type: 'people', targetId: id, text: clear ? `cleared your leave dates` : `marked you away ${shortDate(patch.awayFrom)} – ${shortDate(patch.awayTo)}` })
          }
        },

        deleteTask: (id) => {
          const t = get().tasks.find((x) => x.id === id)
          if (!t) return
          del('tasks', id)
          get().comments.filter((c) => c.taskId === id).forEach((c) => removeLocal('comments', c.id))
          set({ openTaskId: null })
        },

        addComment: (taskId, text) => {
          const s = get()
          const task = s.tasks.find((t) => t.id === taskId)
          const body = text.trim()
          if (!task || !body) return
          put('comments', { id: uid('CM'), taskId, authorId: s.currentUserId, text: body, at: Date.now() })
          const mentioned = s.employees.filter((e) => e.id !== s.currentUserId && new RegExp(`@${firstName(e)}\\b`, 'i').test(body))
          const targets = mentioned.length ? mentioned.map((e) => e.id) : [s.currentUserId === task.assigneeId ? task.assignedById : task.assigneeId]
          targets.filter((x) => x && x !== s.currentUserId).forEach((targetId) =>
            log({ type: 'comment', taskId, clientId: task.clientId, targetId, text: `${mentioned.length ? 'mentioned you on' : 'commented on'} "${task.title}"` }))
        },

        // ---------- daily updates ----------
        saveUpdate: (clientId, text, date = todayIso()) => {
          const s = get()
          const id = `U-${date}-${s.currentUserId}-${clientId ?? 'general'}`
          const body = text.trim()
          if (!body) { if (s.updates.some((u) => u.id === id)) del('updates', id); return }
          put('updates', { id, employeeId: s.currentUserId, clientId: clientId ?? null, date, text: body, at: Date.now() })
        },

        // ---------- post calendar ----------
        savePost: (post) => put('posts', { id: post.id ?? uid('PO'), createdBy: get().currentUserId, at: Date.now(), note: '', ...post }),
        deletePost: (id) => del('posts', id),

        // ---------- people ----------
        createEmployee: (data) => {
          const s = get()
          const palette = ['#2F80ED', '#E0447C', '#0E9F8E', '#8E44AD', '#C77D0A', '#D9480F', '#1F9D55', '#5F3DC4']
          const row = {
            id: nextId(s.employees, 'BM', 3), name: data.name.trim(), title: data.title?.trim() ?? '', department: data.department,
            role: data.role ?? 'member', headId: data.headId || null, email: data.email?.trim().toLowerCase() || null, phone: data.phone?.trim() ?? '',
            color: palette[s.employees.length % palette.length], active: true, createdAt: Date.now(),
          }
          put('employees', row)
          log({ type: 'people', text: `added ${row.name} to ${row.department}` })
          return row.id
        },
        updateEmployee: (id, patch) => {
          const e = get().employees.find((x) => x.id === id)
          if (!e) return
          const clean = { ...patch }
          if ('email' in clean) clean.email = clean.email?.trim().toLowerCase() || null
          put('employees', { ...e, ...clean })
        },

        // ---------- clients ----------
        createClient: (data) => {
          const s = get()
          const palette = ['#2F80ED', '#E0447C', '#0E9F8E', '#8E44AD', '#C77D0A', '#D9480F', '#1F9D55']
          const row = {
            id: nextId(s.clients, 'C', 2), name: data.name.trim(), services: data.services ?? [], ownerId: data.ownerId || null,
            memberIds: [...new Set([data.ownerId, ...(data.memberIds ?? [])].filter(Boolean))],
            deliverables: data.deliverables ?? '', ads: data.ads ?? '', brief: data.brief ?? '',
            color: palette[s.clients.length % palette.length], active: true, createdAt: Date.now(),
          }
          put('clients', row)
          log({ type: 'client', clientId: row.id, targetId: row.ownerId, text: `added client ${row.name}` })
          return row.id
        },
        updateClient: (id, patch) => {
          const c = get().clients.find((x) => x.id === id)
          if (!c) return
          const next = { ...c, ...patch }
          next.memberIds = [...new Set([next.ownerId, ...(next.memberIds ?? [])].filter(Boolean))]
          put('clients', next)
          if (patch.ownerId && patch.ownerId !== c.ownerId) {
            log({ type: 'client', clientId: id, targetId: patch.ownerId, text: `made ${firstName(emp(patch.ownerId))} the account manager for ${c.name}` })
          }
        },

        resetDemo: () => { set({ ...buildSeed(), lastSeen: {}, openTaskId: null, newTask: null }); get().runRepeats() },
      }
    },
    {
      name: isCloud ? 'team-hub-cloud' : 'team-hub-demo-v2',
      partialize: (s) => (isCloud
        ? { theme: s.theme, lastSeen: s.lastSeen }
        : { theme: s.theme, lastSeen: s.lastSeen, currentUserId: s.currentUserId, ...Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) }),
    },
  ),
)

// ---------- small hooks ----------
export const useCurrentUser = () => useStore((s) => s.employees.find((e) => e.id === s.currentUserId) ?? null)
export const useEmployee = (id) => useStore((s) => s.employees.find((e) => e.id === id) ?? null)
export const useClient = (id) => useStore((s) => s.clients.find((c) => c.id === id) ?? null)
