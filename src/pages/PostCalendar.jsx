import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { POST_KINDS, POST_STATUSES } from '../store/seed'
import { isLead } from '../lib/permissions'
import { monthDays, monthLabel, shiftMonth, todayIso, formatDate } from '../lib/date'
import { Avatar, Empty, Modal, PageMotion } from '../components/ui'

export const KIND_CODE = { Reel: 'R', Static: 'S', Carousel: 'CP', Story: 'St', Repost: 'Rp', Post: 'P' }

export function Legend() {
  return (
    <div className="row row-wrap small soft" style={{ gap: 14 }}>
      {POST_STATUSES.map((s) => <span key={s.id} className="row" style={{ gap: 6 }}><span className={`pchip st-${s.id}`} style={{ width: 14, height: 14 }} />{s.label}</span>)}
      <span className="muted">R Reel · S Static · CP Carousel · St Story · Rp Repost · P Post</span>
    </div>
  )
}

function DayEditor({ cell, onClose }) {
  const allPosts = useStore((s) => s.posts)
  const posts = useMemo(() => (cell ? allPosts.filter((p) => p.clientId === cell.clientId && p.date === cell.date) : []), [allPosts, cell])
  const client = useStore((s) => s.clients.find((c) => c.id === cell?.clientId))
  const savePost = useStore((s) => s.savePost)
  const deletePost = useStore((s) => s.deletePost)
  return (
    <Modal open={!!cell} onClose={onClose} title={cell ? `${client?.name} · ${formatDate(cell.date)}` : ''} width={480}
      footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      {posts.length === 0 && <div className="muted small">Nothing planned for this day yet. Add a post below.</div>}
      {posts.map((p) => (
        <div key={p.id} className="post-edit">
          <div className="row between">
            <select className="select select-sm" value={p.kind} onChange={(e) => savePost({ ...p, kind: e.target.value })} aria-label="Type">
              {POST_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <button className="icon-btn" aria-label="Remove post" onClick={() => deletePost(p.id)}><Trash2 /></button>
          </div>
          <div className="status-pills">
            {POST_STATUSES.map((s) => (
              <button key={s.id} className={`status-pill pst-${s.id} ${p.status === s.id ? 'on' : ''}`} onClick={() => savePost({ ...p, status: s.id })}>{s.label}</button>
            ))}
          </div>
          <input className="input" style={{ height: 32 }} placeholder="Note (optional), e.g. Award post" defaultValue={p.note}
            onBlur={(e) => e.target.value !== p.note && savePost({ ...p, note: e.target.value })} />
        </div>
      ))}
      <div>
        <div className="section-title" style={{ marginBottom: 8 }}>Add</div>
        <div className="row row-wrap">
          {POST_KINDS.map((k) => (
            <button key={k} className="btn btn-sm" onClick={() => savePost({ clientId: cell.clientId, date: cell.date, kind: k, status: 'not_ready' })}><Plus />{k}</button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// month grid: one row per client, one column per day
export function PostGrid({ clients, month, groupBy = true }) {
  const posts = useStore((s) => s.posts)
  const employees = useStore((s) => s.employees)
  const [cell, setCell] = useState(null)
  const days = monthDays(month)
  const today = todayIso()
  const byKey = useMemo(() => {
    const m = {}
    posts.forEach((p) => { if (p.date.slice(0, 7) === month.slice(0, 7)) (m[`${p.clientId}|${p.date}`] ??= []).push(p) })
    return m
  }, [posts, month])

  const groups = useMemo(() => {
    if (!groupBy) return [{ ownerId: null, items: clients }]
    const g = {}
    clients.forEach((c) => (g[c.ownerId ?? 'none'] ??= []).push(c))
    return Object.entries(g).map(([ownerId, items]) => ({ ownerId, items }))
      .sort((a, b) => (employees.find((e) => e.id === a.ownerId)?.name ?? 'zz').localeCompare(employees.find((e) => e.id === b.ownerId)?.name ?? 'zz'))
  }, [clients, groupBy, employees])

  const dow = (d) => new Date(`${d}T00:00:00`).getDay()

  return (
    <>
      <div className="pgrid-wrap">
        <table className="pgrid">
          <thead>
            <tr>
              <th className="pg-client">Client</th>
              {days.map((d) => (
                <th key={d} className={`${dow(d) === 0 || dow(d) === 6 ? 'we' : ''} ${d === today ? 'today' : ''}`}>
                  <div className="tiny">{'SMTWTFS'[dow(d)]}</div><div>{Number(d.slice(8))}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ ownerId, items }) => (
              <FragmentRows key={ownerId ?? 'all'} ownerId={groupBy ? ownerId : null} span={days.length + 1}>
                {items.map((c) => {
                  const monthPosts = days.flatMap((d) => byKey[`${c.id}|${d}`] ?? [])
                  const posted = monthPosts.filter((p) => p.status === 'posted').length
                  return (
                    <tr key={c.id}>
                      <td className="pg-client">
                        <Link to={`/clients/${c.id}`} className="strong truncate" style={{ display: 'block' }}>{c.name}</Link>
                        <div className="tiny muted truncate">{monthPosts.length ? `${posted}/${monthPosts.length} posted` : c.deliverables || 'Nothing planned'}</div>
                      </td>
                      {days.map((d) => {
                        const list = byKey[`${c.id}|${d}`] ?? []
                        return (
                          <td key={d} className={`pg-cell ${dow(d) === 0 || dow(d) === 6 ? 'we' : ''} ${d === today ? 'today' : ''}`}>
                            <button onClick={() => setCell({ clientId: c.id, date: d })} aria-label={`${c.name} ${d}: ${list.length} posts`}>
                              {list.map((p) => <span key={p.id} className={`pchip st-${p.status}`} title={`${p.kind} · ${POST_STATUSES.find((s) => s.id === p.status)?.label}${p.note ? ` · ${p.note}` : ''}`}>{KIND_CODE[p.kind] ?? 'P'}</span>)}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </FragmentRows>
            ))}
          </tbody>
        </table>
      </div>
      <DayEditor cell={cell} onClose={() => setCell(null)} />
    </>
  )
}

function FragmentRows({ ownerId, span, children }) {
  const e = useStore((s) => s.employees.find((x) => x.id === ownerId))
  return (
    <>
      {ownerId && (
        <tr className="pg-group"><td colSpan={span}><span className="row" style={{ gap: 8 }}><Avatar id={ownerId} size={20} />{e?.name ?? 'No account manager'}</span></td></tr>
      )}
      {children}
    </>
  )
}

export default function PostCalendar() {
  const user = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const [month, setMonth] = useState(todayIso().slice(0, 8) + '01')
  const [scope, setScope] = useState(isLead(user) ? 'all' : 'mine')

  const list = useMemo(() => clients
    .filter((c) => c.active && c.services?.includes('Social Media'))
    .filter((c) => scope === 'all' || c.memberIds?.includes(user.id))
    .sort((a, b) => a.name.localeCompare(b.name)), [clients, scope, user.id])

  return (
    <PageMotion className="page page-wide">
      <div className="page-head">
        <div><h1>Post Calendar</h1><p className="page-sub">Click any day to plan a post or change its status.</p></div>
        <div className="row">
          <div className="seg">
            <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>My clients</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All clients</button>
          </div>
          <div className="row month-nav">
            <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></button>
            <b style={{ minWidth: 130, textAlign: 'center' }}>{monthLabel(month)}</b>
            <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></button>
          </div>
        </div>
      </div>
      <Legend />
      {list.length === 0
        ? <div className="card"><Empty icon={CalendarDays} title="No social media clients here" text="Switch to All clients." /></div>
        : <div className="card" style={{ overflow: 'hidden' }}><PostGrid clients={list} month={month} /></div>}
    </PageMotion>
  )
}
