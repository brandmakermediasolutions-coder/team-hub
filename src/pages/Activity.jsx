import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity as ActivityIcon } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { scopeIds } from '../lib/permissions'
import { dayHeading, clock } from '../lib/date'
import { Avatar, ClientTag, Empty, PageMotion } from '../components/ui'

const TYPES = [
  { id: 'all', label: 'All', match: null },
  { id: 'assigned', label: 'Assignments', match: ['assigned'] },
  { id: 'status', label: 'Status', match: ['status'] },
  { id: 'comment', label: 'Comments', match: ['comment'] },
  { id: 'blocked', label: 'Blocked', match: ['blocked', 'unblocked'] },
]
const PAGE = 40

export default function Activity() {
  const user = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const activity = useStore((s) => s.activity)
  const openTask = useStore((s) => s.openTask)

  const [person, setPerson] = useState('')
  const [client, setClient] = useState('')
  const [type, setType] = useState('all')
  const [limit, setLimit] = useState(PAGE)

  const role = user?.role
  const ids = useMemo(() => new Set(scopeIds(user, employees)), [user, employees])
  const byId = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])

  const scoped = useMemo(() => {
    if (!user) return []
    if (role === 'admin') return activity
    if (role === 'head') return activity.filter((a) => ids.has(a.actorId) || ids.has(a.targetId))
    return activity.filter((a) => a.actorId === user.id || a.targetId === user.id)
  }, [activity, user, role, ids])

  const people = useMemo(() => employees.filter((e) => ids.has(e.id)), [employees, ids])

  const filtered = useMemo(() => {
    const match = TYPES.find((t) => t.id === type)?.match
    return scoped
      .filter((a) => (!person || a.actorId === person || a.targetId === person) && (!client || a.clientId === client) && (!match || match.includes(a.type)))
      .sort((a, b) => b.at - a.at)
  }, [scoped, person, client, type])

  const shown = filtered.slice(0, limit)
  const groups = useMemo(() => {
    const out = []
    shown.forEach((a) => {
      const h = dayHeading(a.at)
      const last = out[out.length - 1]
      if (last && last.heading === h) last.items.push(a)
      else out.push({ heading: h, items: [a] })
    })
    return out
  }, [shown])

  const reset = (fn) => (v) => { fn(v); setLimit(PAGE) }
  let n = 0

  return (
    <PageMotion>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <div className="page-sub">Everything that happened, newest first.</div>
        </div>
      </div>

      <div className="toolbar">
        {role !== 'employee' && (
          <select className="select select-sm" value={person} onChange={(e) => reset(setPerson)(e.target.value)} aria-label="Filter by person">
            <option value="">Everyone</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select className="select select-sm" value={client} onChange={(e) => reset(setClient)(e.target.value)} aria-label="Filter by client">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="seg">
          {TYPES.map((t) => (
            <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => reset(setType)(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        {filtered.length === 0 ? (
          <Empty icon={ActivityIcon} title="No activity found" text="Nothing matches these filters yet." />
        ) : (
          <>
            {groups.map((g, gi) => (
              <div key={g.heading} style={{ marginTop: gi ? 14 : 0 }}>
                <div className="section-title" style={{ marginBottom: 6 }}>{g.heading}</div>
                {g.items.map((a) => {
                  const delay = Math.min(n++, 12) * 0.025
                  const body = (
                    <>
                      <Avatar id={a.actorId} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div className="feed-text"><b>{byId[a.actorId]?.name ?? 'Someone'}</b> {a.text}</div>
                        <div className="tiny muted row" style={{ gap: 8 }}>
                          <span>{clock(a.at)}</span>
                          {a.clientId && <ClientTag clientId={a.clientId} />}
                        </div>
                      </div>
                    </>
                  )
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay }}>
                      {a.taskId
                        ? <button className="feed-item" onClick={() => openTask(a.taskId)}>{body}</button>
                        : <div className="feed-item">{body}</div>}
                    </motion.div>
                  )
                })}
              </div>
            ))}
            {filtered.length > limit && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + PAGE)}>Show more</button>
              </div>
            )}
          </>
        )}
      </div>
    </PageMotion>
  )
}
