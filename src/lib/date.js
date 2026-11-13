const z = (n) => String(n).padStart(2, '0')

export const iso = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`

export const todayIso = () => iso(new Date())

export const addDays = (n, from = new Date()) => {
  const d = new Date(from)
  d.setDate(d.getDate() + n)
  return iso(d)
}

// whole days from today to an ISO date (negative = past)
export const daysUntil = (isoDate) => {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  const a = new Date(y, m - 1, d)
  const t = new Date()
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((a - b) / 86400000)
}

export const formatDate = (isoDate) => {
  if (!isoDate) return 'No date'
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

// { label, tone } where tone is 'overdue' | 'today' | 'soon' | 'later'
export const dueInfo = (isoDate, done = false) => {
  const n = daysUntil(isoDate)
  if (n === null) return { label: 'No due date', tone: 'later' }
  if (done) return { label: formatDate(isoDate), tone: 'later' }
  if (n < 0) return { label: `Overdue ${-n}d`, tone: 'overdue' }
  if (n === 0) return { label: 'Due today', tone: 'today' }
  if (n === 1) return { label: 'Tomorrow', tone: 'soon' }
  return { label: formatDate(isoDate), tone: n <= 7 ? 'soon' : 'later' }
}

export const relTime = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const dayHeading = (ts) => {
  const n = daysUntil(iso(new Date(ts)))
  if (n === 0) return 'Today'
  if (n === -1) return 'Yesterday'
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const clock = (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const shortDate = (isoDate) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// all ISO dates in the month of the given ISO date ('2026-11-12' -> ['2026-11-01', …])
export const monthDays = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${y}-${z(m)}-${z(i + 1)}`)
}

export const shiftMonth = (isoDate, delta) => {
  const [y, m] = isoDate.split('-').map(Number)
  return iso(new Date(y, m - 1 + delta, 1))
}

// Monday of the week that contains the given ISO date
export const weekStart = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(d - ((dt.getDay() + 6) % 7))
  return iso(dt)
}

// the 7 ISO dates (Mon–Sun) starting at the given Monday
export const weekDays = (isoStart) => {
  const [y, m, d] = isoStart.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => iso(new Date(y, m - 1, d + i)))
}

export const shiftWeek = (isoStart, delta) => {
  const [y, m, d] = isoStart.split('-').map(Number)
  return iso(new Date(y, m - 1, d + delta * 7))
}

// '10 – 16 Nov 2026' / '27 Oct – 2 Nov 2026'
export const weekLabel = (isoStart) => {
  const da = new Date(`${isoStart}T12:00:00`)
  const db = new Date(`${weekDays(isoStart)[6]}T12:00:00`)
  const same = da.getMonth() === db.getMonth()
  const left = da.toLocaleDateString('en-IN', same ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${left} – ${db.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export const monthLabel = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
