// Who can see / do what. Roles: 'admin' (owner), 'head' (team head), 'employee'.

export const ROLE_LABEL = { admin: 'Admin', head: 'Team head', employee: 'Employee' }

// ids of the people a user is responsible for (self + direct reports; admin = everyone)
export function scopeIds(user, employees) {
  if (!user) return []
  if (user.role === 'admin') return employees.map((e) => e.id)
  if (user.role === 'head') return [user.id, ...employees.filter((e) => e.headId === user.id).map((e) => e.id)]
  return [user.id]
}

export function visibleTasks(user, tasks, employees) {
  if (!user) return []
  if (user.role === 'admin') return tasks
  const ids = new Set(scopeIds(user, employees))
  return tasks.filter((t) => ids.has(t.assigneeId) || t.assignedById === user.id || t.blocked?.onId === user.id)
}

// people this user may assign a task to
export function assignableEmployees(user, employees) {
  const ids = new Set(scopeIds(user, employees))
  return employees.filter((e) => e.active && ids.has(e.id))
}

export function canEditTask(user, task, employees) {
  if (!user || !task) return false
  if (user.role === 'admin') return true
  if (task.assigneeId === user.id || task.assignedById === user.id) return true
  return user.role === 'head' && scopeIds(user, employees).includes(task.assigneeId)
}

export function canReassign(user, task, employees) {
  if (!user || !task) return false
  if (user.role === 'admin') return true
  return user.role === 'head' && (task.assignedById === user.id || scopeIds(user, employees).includes(task.assigneeId))
}

export function visibleClients(user, clients, projects, tasks, employees) {
  if (!user) return []
  if (user.role === 'admin') return clients
  const ids = new Set(scopeIds(user, employees))
  const mine = new Set()
  clients.forEach((c) => ids.has(c.ownerId) && mine.add(c.id))
  projects.forEach((p) => p.memberIds.some((m) => ids.has(m)) && mine.add(p.clientId))
  visibleTasks(user, tasks, employees).forEach((t) => t.clientId && mine.add(t.clientId))
  return clients.filter((c) => mine.has(c.id))
}

export const canManageClients = (user) => user?.role === 'admin' || user?.role === 'head'
export const isAdmin = (user) => user?.role === 'admin'
