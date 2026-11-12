import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, STATUSES } from './seed'

/*
  Single app store (persisted to localStorage — this draft has no backend yet).

  DATA      employees, clients, projects, tasks, comments, activity
  SESSION   currentUserId, theme, lastSeen{userId: ts}
  UI        openTaskId (task drawer), newTask (null | {defaults} for the New-task modal)

  ACTIONS
    login(id, password) -> { ok, error? }        logout()
    createTask(data) -> id                        updateTask(id, patch)
    addComment(taskId, text)
    createEmployee(data) -> id                    updateEmployee(id, patch)
    createClient(data) -> id                      updateClient(id, patch)
    reassignClient(clientId, ownerId, note?)
    createProject(data) -> id                     updateProject(id, patch)
    openTask(id) / closeTask()                    openNewTask(defaults?) / closeNewTask()
    toggleTheme()   markSeen()   resetDemo()
*/

const nextId = (list, prefix, pad = 2, start = 1) => {
  const max = list.reduce((m, x) => Math.max(m, parseInt(String(x.id).split('-')[1], 10) || 0), start - 1)
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}
const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id
const firstName = (e) => e?.name?.split(' ')[0] ?? 'someone'

export const useStore = create(
  persist(
    (set, get) => {
      const log = (entry) => ({
        id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: Date.now(),
        actorId: get().currentUserId,
        ...entry,
      })
      const emp = (id) => get().employees.find((e) => e.id === id)

      return {
        ...buildSeed(),
        currentUserId: null,
        theme: 'light',
        lastSeen: {},
        openTaskId: null,
        newTask: null,
        toast: null,
        showToast: (message) => {
          const id = Date.now()
          set({ toast: { id, message } })
          setTimeout(() => get().toast?.id === id && set({ toast: null }), 2600)
        },

        // ---------- session ----------
        login: (rawId, password) => {
          const id = String(rawId).trim().toUpperCase()
          const user = get().employees.find((e) => e.id === id)
          if (!user || user.password !== password) return { ok: false, error: 'Wrong employee ID or password.' }
          if (!user.active) return { ok: false, error: 'This account is deactivated. Ask your admin.' }
          set({ currentUserId: user.id, openTaskId: null, newTask: null })
          return { ok: true }
        },
        logout: () => set({ currentUserId: null, openTaskId: null, newTask: null }),
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
          const id = nextId(s.tasks, 'T', 3, 101)
          const task = {
            id,
            title: data.title.trim(),
            description: data.description ?? '',
            doneWhen: data.doneWhen ?? '',
            clientId: data.clientId || null,
            projectId: data.projectId || null,
            assigneeId: data.assigneeId,
            assignedById: s.currentUserId,
            due: data.due || null,
            priority: data.priority ?? 'medium',
            status: 'todo',
            links: data.links ?? [],
            blocked: null,
            createdAt: Date.now(),
            completedAt: null,
          }
          const self = task.assigneeId === s.currentUserId
          set({
            tasks: [task, ...s.tasks],
            activity: [
              log({
                type: 'assigned',
                text: self ? `created "${task.title}"` : `assigned "${task.title}" to ${firstName(emp(task.assigneeId))}`,
                taskId: id, clientId: task.clientId, targetId: task.assigneeId,
              }),
              ...s.activity,
            ],
          })
          return id
        },

        updateTask: (id, patch) => {
          const s = get()
          const old = s.tasks.find((t) => t.id === id)
          if (!old) return
          const next = { ...old, ...patch }
          const entries = []
          const base = { taskId: id, clientId: next.clientId }
          const notify = s.currentUserId === next.assigneeId ? next.assignedById : next.assigneeId

          if (patch.status && patch.status !== old.status) {
            next.completedAt = patch.status === 'done' ? Date.now() : null
            if (patch.status === 'done') next.blocked = null
            entries.push(log({ ...base, type: 'status', targetId: notify,
              text: patch.status === 'done' ? `completed "${next.title}"` : `moved "${next.title}" to ${statusLabel(patch.status)}` }))
          }
          if (patch.assigneeId && patch.assigneeId !== old.assigneeId) {
            entries.push(log({ ...base, type: 'assigned', targetId: patch.assigneeId,
              text: `reassigned "${next.title}" from ${firstName(emp(old.assigneeId))} to ${firstName(emp(patch.assigneeId))}` }))
          }
          if ('due' in patch && patch.due !== old.due) {
            entries.push(log({ ...base, type: 'edit', targetId: notify, text: `changed the due date of "${next.title}"` }))
          }
          if (patch.priority && patch.priority !== old.priority) {
            entries.push(log({ ...base, type: 'edit', targetId: notify, text: `set "${next.title}" to ${patch.priority} priority` }))
          }
          if ('blocked' in patch && !!patch.blocked !== !!old.blocked) {
            entries.push(log({ ...base, type: patch.blocked ? 'blocked' : 'unblocked', targetId: patch.blocked ? patch.blocked.onId : notify,
              text: patch.blocked
                ? `marked "${next.title}" as blocked — waiting on ${firstName(emp(patch.blocked.onId))}`
                : `unblocked "${next.title}"` }))
          }
          set({ tasks: s.tasks.map((t) => (t.id === id ? next : t)), activity: [...entries, ...s.activity] })
        },

        addComment: (taskId, text) => {
          const s = get()
          const task = s.tasks.find((t) => t.id === taskId)
          const body = text.trim()
          if (!task || !body) return
          const mentioned = s.employees.filter((e) => new RegExp(`@${firstName(e)}\\b`, 'i').test(body) && e.id !== s.currentUserId)
          const targets = mentioned.length
            ? mentioned.map((e) => e.id)
            : [s.currentUserId === task.assigneeId ? task.assignedById : task.assigneeId]
          set({
            comments: [...s.comments, { id: `CM-${Date.now()}`, taskId, authorId: s.currentUserId, text: body, at: Date.now() }],
            activity: [
              ...targets.map((targetId) => log({ type: 'comment', taskId, clientId: task.clientId, targetId,
                text: `${mentioned.length ? 'mentioned you on' : 'commented on'} "${task.title}"` })),
              ...s.activity,
            ],
          })
        },

        // ---------- people ----------
        createEmployee: (data) => {
          const s = get()
          const id = nextId(s.employees, 'BM', 3)
          const palette = ['#2F80ED', '#E0447C', '#0E9F8E', '#8E44AD', '#C77D0A', '#D9480F', '#1F9D55', '#5F3DC4']
          set({
            employees: [...s.employees, {
              id, name: data.name.trim(), role: data.role ?? 'employee', title: data.title ?? '', team: data.team,
              headId: data.headId || null, color: palette[s.employees.length % palette.length], active: true,
              password: data.password || 'demo123',
            }],
            activity: [log({ type: 'people', text: `added ${data.name.trim()} (${id}) to ${data.team}`, targetId: data.headId || null }), ...s.activity],
          })
          return id
        },
        updateEmployee: (id, patch) => set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

        // ---------- clients & projects ----------
        createClient: (data) => {
          const s = get()
          const id = nextId(s.clients, 'C')
          const palette = ['#2F80ED', '#E0447C', '#0E9F8E', '#8E44AD', '#C77D0A', '#D9480F', '#1F9D55']
          const now = new Date()
          const since = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
          set({
            clients: [...s.clients, {
              id, name: data.name.trim(), industry: data.industry ?? '', services: data.services ?? [],
              ownerId: data.ownerId, since, color: palette[s.clients.length % palette.length], brief: data.brief ?? '',
            }],
            activity: [log({ type: 'client', clientId: id, targetId: data.ownerId,
              text: `added client ${data.name.trim()} and assigned it to ${firstName(emp(data.ownerId))}` }), ...s.activity],
          })
          return id
        },
        updateClient: (id, patch) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        reassignClient: (clientId, ownerId, note = '') => {
          const s = get()
          const client = s.clients.find((c) => c.id === clientId)
          if (!client || client.ownerId === ownerId) return
          set({
            clients: s.clients.map((c) => (c.id === clientId ? { ...c, ownerId } : c)),
            activity: [log({ type: 'client', clientId, targetId: ownerId,
              text: `assigned client ${client.name} to ${firstName(emp(ownerId))}${note.trim() ? ` — handover: ${note.trim()}` : ''}` }), ...s.activity],
          })
        },
        createProject: (data) => {
          const s = get()
          const id = nextId(s.projects, 'P')
          const client = s.clients.find((c) => c.id === data.clientId)
          set({
            projects: [...s.projects, { id, clientId: data.clientId, name: data.name.trim(), service: data.service, memberIds: data.memberIds ?? [], status: 'active' }],
            activity: [log({ type: 'project', clientId: data.clientId, text: `created project "${data.name.trim()}" for ${client?.name ?? 'a client'}` }), ...s.activity],
          })
          return id
        },
        updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

        resetDemo: () => set({ ...buildSeed(), lastSeen: {}, openTaskId: null, newTask: null }),
      }
    },
    {
      name: 'team-hub-v1',
      partialize: ({ openTaskId, newTask, toast, ...rest }) => rest,
    },
  ),
)

// ---------- small selectors / hooks ----------
export const useCurrentUser = () => useStore((s) => s.employees.find((e) => e.id === s.currentUserId) ?? null)
export const useEmployee = (id) => useStore((s) => s.employees.find((e) => e.id === id) ?? null)
