// Roles: 'admin' (sees and edits everything), 'head' (department head), 'member'.
// Anyone can give a task to anyone. Heads and the admin can see their team's work at a glance.

export const ROLE_LABEL = { admin: 'Admin', head: 'Head', member: 'Member' }

export const isAdmin = (u) => u?.role === 'admin'
export const isLead = (u) => u?.role === 'admin' || u?.role === 'head'

// self + everyone who reports to me (directly or further down); admin = everyone
export function teamIds(user, employees) {
  if (!user) return []
  if (isAdmin(user)) return employees.map((e) => e.id)
  const out = new Set([user.id])
  let grew = true
  while (grew) {
    grew = false
    employees.forEach((e) => { if (e.headId && out.has(e.headId) && !out.has(e.id)) { out.add(e.id); grew = true } })
  }
  return [...out]
}

export function canEditTask(user, task, employees) {
  if (!user || !task) return false
  if (isAdmin(user) || task.assigneeId === user.id || task.assignedById === user.id) return true
  return user.role === 'head' && teamIds(user, employees).includes(task.assigneeId)
}

export const canDeleteTask = (user, task) => isAdmin(user) || task?.assignedById === user?.id
export const canManageClients = isLead
