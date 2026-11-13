import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { POST_KINDS, POST_STATUSES } from '../store/seed'
import { isLead } from '../lib/permissions'
import { monthDays, monthLabel, shiftMonth, todayIso, formatDate, weekStart, weekDays, shiftWeek, weekLabel } from '../lib/date'
import { Avatar, Empty, Modal, PageMotion } from '../components/ui'

export const KIND_CODE = { Reel: 'R', Static: 'S', Carousel: 'CP', Story: 'St', Repost: 'Rp', Post: 'P' }

const STATUS_LABEL = Object.fromEntries(POST_STATUSES.map((s) => [s.id, s.label]))
const statusLabel = (id) => STATUS_LABEL[id] ?? id
const postTitle = (p) => `${p.kind} · ${statusLabel(p.status)} · ${formatDate(p.date)}${p.note ? `\n${p.note}` : ''}`
const dow = (d) => new Date(`${d}T00:00:00`).getDay()
const dayClass = (d, today) => {
  const w = dow(d)
  return [w === 0 || w === 6 ? 'we' : '', w === 0 ? 'sun' : '', d === today ? 'today' : ''].filter(Boolean).join(' ')
}
const VIEW_KEY = 'teamhub.postCalendar.view'
const ease = [0.2, 0.8, 0.2, 1]

export function Legend() {
  return (
    <div className="pc-legend" aria-label="Legend">
      {POST_STATUSES.map((s) => <span key={s.id} className="pc-legend-chip"><span className={`pc-swatch st-${s.id}`} />{s.label}</span>)}
      <span className="pc-legend-sep" aria-hidden />
      {POST_KINDS.map((k) => <span key={k} className="pc-legend-chip pc-kind"><b>{KIND_CODE[k]}</b>{k}</span>)}
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

// posts within the given days, indexed by `client|date` and by client
function usePostIndex(days) {
  const posts = useStore((s) => s.posts)
  return useMemo(() => {
    const set = new Set(days)
    const byKey = {}
    const byClient = {}
    posts.forEach((p) => {
      if (!set.has(p.date)) return
      ;(byKey[`${p.clientId}|${p.date}`] ??= []).push(p)
      ;(byClient[p.clientId] ??= []).push(p)
    })
    return { byKey, byClient }
  }, [posts, days])
}

// clients grouped by account manager; inside a group, clients with posts first
function useGroups(clients, groupBy, byClient) {
  const employees = useStore((s) => s.employees)
  return useMemo(() => {
    const busyFirst = (list) => [...list].sort((a, b) => Number(!byClient[a.id]) - Number(!byClient[b.id]))
    if (!groupBy) return [{ ownerId: null, items: busyFirst(clients) }]
    const g = {}
    clients.forEach((c) => (g[c.ownerId ?? 'none'] ??= []).push(c))
    const nameOf = (id) => employees.find((e) => e.id === id)?.name ?? 'zz'
    return Object.entries(g).map(([ownerId, items]) => ({ ownerId, items: busyFirst(items) }))
      .sort((a, b) => nameOf(a.ownerId).localeCompare(nameOf(b.ownerId)))
  }, [clients, groupBy, byClient, employees])
}

const countBy = (list) => list.reduce((m, p) => ({ ...m, [p.status]: (m[p.status] ?? 0) + 1 }), {})
const progressTitle = (list) => {
  const c = countBy(list)
  return POST_STATUSES.filter((s) => c[s.id]).map((s) => `${c[s.id]} ${s.label.toLowerCase()}`).join(' · ')
}

function Progress({ list }) {
  const c = countBy(list)
  const n = list.length
  return (
    <div className="pg-progress" title={progressTitle(list)}>
      <div className="pg-bar">
        {['posted', 'scheduled', 'ready'].map((id) => (c[id] ? <span key={id} className={`sb-${id}`} style={{ width: `${(c[id] / n) * 100}%` }} /> : null))}
      </div>
      <span className="pg-count mono"><b>{c.posted ?? 0}</b>/{n}</span>
    </div>
  )
}

function OwnerLabel({ ownerId, items, byClient }) {
  const e = useStore((s) => s.employees.find((x) => x.id === ownerId))
  const planned = items.reduce((n, c) => n + (byClient[c.id]?.length ?? 0), 0)
  return (
    <span className="pg-owner">
      <Avatar id={ownerId} size={20} /><span>{e?.name ?? 'No account manager'}</span>
      <span className="muted tiny">{items.length} client{items.length === 1 ? '' : 's'}{planned ? ` · ${planned} planned` : ''}</span>
    </span>
  )
}

// ------------------------------- month view -------------------------------

function CellPosts({ posts }) {
  if (!posts.length) return <Plus className="pg-add" aria-hidden />
  const shown = posts.length > 2 ? posts.slice(0, 1) : posts
  return (
    <span className={`pg-stack n${posts.length > 2 ? 'x' : posts.length}`}>
      {shown.map((p) => <span key={p.id} className={`pchip st-${p.status}`} title={postTitle(p)}>{KIND_CODE[p.kind] ?? 'P'}</span>)}
      {posts.length > 2 && <span className="pg-more" title={posts.map(postTitle).join('\n\n')}>+{posts.length - 1}</span>}
    </span>
  )
}

// month grid: one row per client, one column per day (also used on the client page)
export function PostGrid({ clients, month, groupBy = true }) {
  const [cell, setCell] = useState(null)
  const days = useMemo(() => monthDays(month), [month])
  const { byKey, byClient } = usePostIndex(days)
  const groups = useGroups(clients, groupBy, byClient)
  const today = todayIso()

  return (
    <>
      <div className="pgrid-wrap">
        <table className="pgrid" style={{ '--days': days.length }}>
          <colgroup><col className="pg-col-client" />{days.map((d) => <col key={d} />)}</colgroup>
          <thead>
            <tr>
              <th className="pg-client">Client</th>
              {days.map((d) => (
                <th key={d} className={dayClass(d, today)} title={formatDate(d)}>
                  <span className="pg-dow">{'SMTWTFS'[dow(d)]}</span><span className="pg-num">{Number(d.slice(8))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody key={month} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease }}>
            {groups.map(({ ownerId, items }) => (
              <Fragment key={ownerId ?? 'all'}>
                {groupBy && (
                  <tr className="pg-group"><td colSpan={days.length + 1}><OwnerLabel ownerId={ownerId} items={items} byClient={byClient} /></td></tr>
                )}
                {items.map((c) => {
                  const list = byClient[c.id] ?? []
                  return (
                    <tr key={c.id} className={`pg-row ${list.length ? '' : 'is-empty'}`}>
                      <td className="pg-client" title={c.deliverables ? `Scope: ${c.deliverables}` : undefined}>
                        <Link to={`/clients/${c.id}`} className="pg-name truncate">{c.name}</Link>
                        {list.length ? <Progress list={list} /> : <span className="pg-none tiny muted">Nothing planned</span>}
                      </td>
                      {days.map((d) => {
                        const ps = byKey[`${c.id}|${d}`] ?? []
                        return (
                          <td key={d} className={`pg-cell ${dayClass(d, today)}`}>
                            <button onClick={() => setCell({ clientId: c.id, date: d })} aria-label={`${c.name} ${formatDate(d)}: ${ps.length ? ps.map((p) => `${p.kind} ${statusLabel(p.status)}`).join(', ') : 'add a post'}`}>
                              <CellPosts posts={ps} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </motion.tbody>
        </table>
      </div>
      <DayEditor cell={cell} onClose={() => setCell(null)} />
    </>
  )
}

// ------------------------------- week view -------------------------------

export function WeekGrid({ clients, start, groupBy = true }) {
  const [cell, setCell] = useState(null)
  const days = useMemo(() => weekDays(start), [start])
  const { byKey, byClient } = usePostIndex(days)
  const groups = useGroups(clients, groupBy, byClient)
  const today = todayIso()
  const wd = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })

  return (
    <>
      <div className="wk">
        <div className="wk-head">
          <div className="wk-client">Client</div>
          {days.map((d) => (
            <div key={d} className={`wk-day-h ${dayClass(d, today)}`}><span>{wd(d)}</span><b>{Number(d.slice(8))}</b></div>
          ))}
        </div>
        <motion.div key={start} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }}>
          {groups.map(({ ownerId, items }) => (
            <Fragment key={ownerId ?? 'all'}>
              {groupBy && <div className="wk-group"><OwnerLabel ownerId={ownerId} items={items} byClient={byClient} /></div>}
              {items.map((c) => {
                const list = byClient[c.id] ?? []
                return (
                  <div key={c.id} className={`wk-row ${list.length ? '' : 'is-empty'}`}>
                    <div className="wk-client" title={c.deliverables ? `Scope: ${c.deliverables}` : undefined}>
                      <Link to={`/clients/${c.id}`} className="pg-name truncate">{c.name}</Link>
                      {list.length ? <Progress list={list} /> : <span className="tiny muted">Nothing this week</span>}
                    </div>
                    {days.map((d) => {
                      const ps = byKey[`${c.id}|${d}`] ?? []
                      const open = () => setCell({ clientId: c.id, date: d })
                      return (
                        <div key={d} className={`wk-cell ${dayClass(d, today)} ${ps.length ? '' : 'is-free'}`}>
                          <span className="wk-cell-day">{formatDate(d)}</span>
                          <div className="wk-cell-posts">
                            {ps.map((p) => (
                              <button key={p.id} className={`wk-post sb-${p.status}`} title={postTitle(p)} onClick={open}>
                                <span className="wk-post-top"><b>{p.kind}</b><span className={`wk-status st-${p.status}`}>{statusLabel(p.status)}</span></span>
                                {p.note && <span className="wk-note clamp-2">{p.note}</span>}
                              </button>
                            ))}
                            {!ps.length && <button className="wk-add" onClick={open} aria-label={`Add a post for ${c.name} on ${formatDate(d)}`} title="Add a post"><Plus /></button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </motion.div>
      </div>
      <DayEditor cell={cell} onClose={() => setCell(null)} />
    </>
  )
}

// ------------------------------- page -------------------------------

const readView = () => {
  try { return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month' } catch { return 'month' }
}

export default function PostCalendar() {
  const user = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const today = todayIso()
  const [view, setViewState] = useState(readView)
  const [month, setMonth] = useState(today.slice(0, 8) + '01')
  const [week, setWeek] = useState(() => weekStart(today))
  const [scope, setScope] = useState(isLead(user) ? 'all' : 'mine')

  const list = useMemo(() => clients
    .filter((c) => c.active && c.services?.includes('Social Media'))
    .filter((c) => scope === 'all' || c.memberIds?.includes(user.id))
    .sort((a, b) => a.name.localeCompare(b.name)), [clients, scope, user.id])

  // keep month and week roughly in step when switching views
  const setView = (v) => {
    if (v === view) return
    if (v === 'month') setMonth(weekDays(week)[3].slice(0, 8) + '01')
    else setWeek(month.slice(0, 7) === today.slice(0, 7) ? weekStart(today) : weekStart(month))
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ }
  }
  const shift = (n) => (view === 'month' ? setMonth(shiftMonth(month, n)) : setWeek(shiftWeek(week, n)))
  const goToday = () => { setMonth(today.slice(0, 8) + '01'); setWeek(weekStart(today)) }
  const onNow = view === 'month' ? month.slice(0, 7) === today.slice(0, 7) : week === weekStart(today)
  const unit = view === 'month' ? 'month' : 'week'

  return (
    <PageMotion className="page page-wide">
      <div className="page-head">
        <div><h1>Post Calendar</h1><p className="page-sub">Click any day to plan a post or change its status.</p></div>
        <div className="row row-wrap pc-controls">
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
            <button role="tab" aria-selected={view === 'week'} className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
          </div>
          <div className="seg">
            <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>My clients</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All clients</button>
          </div>
          <button className="btn btn-sm" onClick={goToday} disabled={onNow}>Today</button>
          <div className="row month-nav">
            <button className="icon-btn" aria-label={`Previous ${unit}`} onClick={() => shift(-1)}><ChevronLeft /></button>
            <b className="pc-period">{view === 'month' ? monthLabel(month) : weekLabel(week)}</b>
            <button className="icon-btn" aria-label={`Next ${unit}`} onClick={() => shift(1)}><ChevronRight /></button>
          </div>
        </div>
      </div>
      <Legend />
      {list.length === 0
        ? <div className="card"><Empty icon={CalendarDays} title="No social media clients here" text="Switch to All clients." /></div>
        : (
          <motion.div key={view} className="card pc-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease }}>
            {view === 'month' ? <PostGrid clients={list} month={month} /> : <WeekGrid clients={list} start={week} />}
          </motion.div>
        )}
    </PageMotion>
  )
}
