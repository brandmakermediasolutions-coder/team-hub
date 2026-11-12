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
