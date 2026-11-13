import { SERVICE_SHORT, SERVICE_IN_TITLE, WEEKDAYS } from '../store/seed'
import { iso, shortDate, todayIso, weekDays, weekStart } from './date'

/*
  Repeating tasks, task templates and "who does it" rules.

  A repeating rule:
    { id, title, scope: 'service' | 'client' | 'none', services[], clientId,
      assign: 'service' | 'owner' | 'person', personId,
      freq: 'monthly' | 'weekly', day, dueDay, active }
    monthly: appears on `day` of the month, due on `dueDay` (next month if dueDay < day)
    weekly:  appears and is due on weekday `day` (1 = Monday … 7 = Sunday)
  Title can use {client} and {service}.

  Each instance has a fixed id: T-R-<ruleId>-<period>-<clientId>-<service>, so two people
  opening Team Hub at the same moment create the same task once.
*/

const SERVICE_CODE = { 'Social Media': 'SM', 'Performance Marketing': 'PPC', SEO: 'SEO', Creative: 'CR', Website: 'WEB' }
// which department looks after a service (Social Media is the account manager's job)
const SERVICE_DEPT = { 'Performance Marketing': 'Performance Marketing', SEO: 'SEO', Creative: 'Creative' }

const byId = (employees, id) => employees.find((e) => e.id === id && e.active) ?? null
export const deptHead = (dep, employees) => employees.find((e) => e.active && e.role === 'head' && e.department === dep) ?? null
export const adminOf = (employees) => employees.find((e) => e.active && e.role === 'admin') ?? null

const ownerOf = (client, employees) =>
  byId(employees, client?.ownerId)?.id ?? deptHead('Social Media', employees)?.id ?? adminOf(employees)?.id ?? null

// the person who does a service's work on a client
export function servicePerson(service, client, employees) {
  const dep = SERVICE_DEPT[service]
  if (!dep) return ownerOf(client, employees)
  const onIt = (client?.memberIds ?? []).map((id) => byId(employees, id)).filter((e) => e && e.department === dep)
  const pick = onIt.find((e) => e.role !== 'head') ?? onIt[0] ?? deptHead(dep, employees)
  return pick?.id ?? ownerOf(client, employees)
}

export function resolvePerson({ assign, service, personId }, client, employees) {
  if (assign === 'person') return byId(employees, personId)?.id ?? (client ? ownerOf(client, employees) : adminOf(employees)?.id ?? null)
  if (assign === 'owner') return client ? ownerOf(client, employees) : adminOf(employees)?.id ?? null
  return client ? servicePerson(service, client, employees) : adminOf(employees)?.id ?? null
}

// "given by" for an automatic task: the head of the service's department (or of the assignee's), else the admin
export function autoGiver(service, assigneeId, employees) {
  const dep = SERVICE_DEPT[service] ?? (service === 'Social Media' ? 'Social Media' : byId(employees, assigneeId)?.department)
  return (dep && deptHead(dep, employees)?.id) || adminOf(employees)?.id || assigneeId
}

const fill = (title, client, service) => title
  .replace(/\{client\}/g, client?.name ?? '')
  .replace(/\{service\}/g, service ? SERVICE_IN_TITLE[service] ?? service : '')
  .replace(/\s+—\s*$/, '').replace(/\s{2,}/g, ' ').trim()

const clampDay = (y, m, d) => iso(new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate())))

// period key, due date, and whether it has started, for a rule on a given day
export function periodOf(rule, today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number)
  if (rule.freq === 'weekly') {
    const start = weekStart(today)
    const wd = Math.min(Math.max(Number(rule.day) || 1, 1), 7)
    const dow = ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1
    return { period: start, started: dow >= wd, due: weekDays(start)[wd - 1] }
  }
  const day = Math.max(Number(rule.day) || 1, 1)
  const dueDay = Math.max(Number(rule.dueDay) || day, 1)
  const appears = clampDay(y, m, day)
  const due = dueDay >= day ? clampDay(y, m, dueDay) : clampDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, dueDay)
  return { period: `${y}-${String(m).padStart(2, '0')}`, started: today >= appears, due }
}

// the work units of a rule: [{ client, service }]
function unitsOf(rule, clients) {
  if (rule.scope === 'none') return [{ client: null, service: null }]
  const pool = rule.scope === 'client' ? clients.filter((c) => c.id === rule.clientId && c.active) : clients.filter((c) => c.active)
  const out = []
  pool.forEach((c) => {
    const svcs = (rule.services ?? []).filter((s) => (c.services ?? []).includes(s))
    if (svcs.length) svcs.forEach((s) => out.push({ client: c, service: s }))
    else if (rule.scope === 'client' && !(rule.services ?? []).length) out.push({ client: c, service: null })
  })
  return out
}

// Every task that should exist today for the active rules (current period only, no backfill).
export function dueRepeats(rules, clients, employees, today = todayIso()) {
  const now = Date.now()
  const out = []
  rules.filter((r) => r.active).forEach((rule) => {
    const p = periodOf(rule, today)
    if (!p.started) return
    // a rule never makes tasks that were already due before the rule existed
    // (so switching a rule on mid-month doesn't hand everyone overdue work)
    if (rule.createdAt && p.due < iso(new Date(Number(rule.createdAt)))) return
    unitsOf(rule, clients).forEach(({ client, service }) => {
      const assigneeId = resolvePerson({ assign: rule.assign, service: service ?? rule.services?.[0], personId: rule.personId }, client, employees)
      if (!assigneeId) return
      out.push({
        id: `T-R-${rule.id}-${p.period}-${client?.id ?? 'none'}-${service ? SERVICE_CODE[service] ?? 'X' : 'all'}`,
        title: fill(rule.title, client, service), clientId: client?.id ?? null,
        assigneeId, assignedById: autoGiver(service, assigneeId, employees),
        due: p.due, status: 'todo', urgent: false, notes: '', links: [],
        createdAt: now, updatedAt: now, completedAt: null, repeatRuleId: rule.id,
      })
    })
  })
  return out
}

// ---------- plain-language summaries ----------
export const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')}`
const orList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
export const shortService = (s) => SERVICE_SHORT[s] ?? s

export function scheduleText(rule) {
  if (rule.freq === 'weekly') return `Every ${WEEKDAYS[(Number(rule.day) || 1) - 1]}`
  return `Monthly on the ${ordinal(Number(rule.day) || 1)}, due the ${ordinal(Number(rule.dueDay) || 1)}`
}

export function ruleSummary(rule, clients, employees) {
  const svcs = (rule.services ?? []).map(shortService)
  const client = clients.find((c) => c.id === rule.clientId)
  const scope = rule.scope === 'none' ? 'no client'
    : rule.scope === 'client' ? (client?.name ?? 'a removed client')
    : `each ${orList(svcs)} client${svcs.length > 1 ? ' (one per service)' : ''}`
  const who = rule.assign === 'person' ? `to ${employees.find((e) => e.id === rule.personId)?.name.split(' ')[0] ?? 'someone'}`
    : rule.assign === 'owner' ? 'to the account manager'
    : svcs.length === 1 ? `to the ${svcs[0]} person` : "to each service's person"
  return [scheduleText(rule), scope, who].join(' · ')
}

// ---------- review ----------
const lead = (e) => e && (e.role === 'admin' || e.role === 'head')
// giver if they are a head/admin, else the assignee's head, else the admin
export function reviewerFor(task, employees) {
  const giver = byId(employees, task.assignedById)
  const doer = employees.find((e) => e.id === task.assigneeId)
  if (lead(giver) && giver.id !== task.assigneeId) return giver.id
  const head = byId(employees, doer?.headId)
  if (head) return head.id
  if (lead(giver)) return giver.id
  return adminOf(employees)?.id ?? null
}

// ---------- on leave ----------
export const hasLeave = (e) => Boolean(e?.awayFrom && e?.awayTo)
export const isAway = (e, date = todayIso()) => hasLeave(e) && e.awayFrom <= date && date <= e.awayTo
export const awayDuring = (e, date) => Boolean(date) && isAway(e, date)
export const leaveText = (e) => (!hasLeave(e) ? ''
  : e.awayFrom === e.awayTo ? shortDate(e.awayFrom) : `${shortDate(e.awayFrom)} – ${shortDate(e.awayTo)}`)
export const awayLabel = (e, date = todayIso()) => (isAway(e, date) ? `Away till ${shortDate(e.awayTo)}` : '')
