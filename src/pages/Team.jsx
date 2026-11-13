import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, PenLine, TriangleAlert, Hourglass, CircleCheck, Users, Plane } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { DEPARTMENTS } from '../store/seed'
import { canEditTask, teamIds } from '../lib/permissions'
import { addDays, daysUntil, formatDate, todayIso } from '../lib/date'
import { hasLeave, isAway, leaveText } from '../lib/repeat'
import { Avatar, AwayTag, ClientTag, Due, Empty, PageMotion, TaskRow } from '../components/ui'
import { PeopleOptions } from '../components/NewTaskModal'
import AwayForm from '../components/AwayForm'

// people on leave now (or within the next week), with their open work due before they're back
function AwaySection({ people }) {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const updateTask = useStore((s) => s.updateTask)
  const openTask = useStore((s) => s.openTask)
  const showToast = useStore((s) => s.showToast)
  const [editing, setEditing] = useState(null)
  const rows = useMemo(() => {
    const today = todayIso()
    const soon = addDays(7)
    return people.filter((e) => hasLeave(e) && e.awayTo >= today && e.awayFrom <= soon).map((e) => ({
      e,
      list: tasks.filter((t) => t.assigneeId === e.id && t.status !== 'done' && t.due && t.due <= e.awayTo && (isAway(e) || t.due >= e.awayFrom))
        .sort((a, b) => a.due.localeCompare(b.due)),
    }))
  }, [people, tasks])
  if (!rows.length) return null
  const give = (t, id) => {
    if (!id) return
    updateTask(t.id, { assigneeId: id })
    showToast(`Given to ${employees.find((x) => x.id === id)?.name ?? 'them'}`)
  }
  return (
    <div className="card">
      <div className="card-head"><h2 className="row"><Plane size={16} />Away</h2><span className="muted small">Open work due before they're back</span></div>
      <div className="away-list">
        {rows.map(({ e, list }) => (
          <div key={e.id} className="away-person">
            <div className="row" style={{ gap: 10 }}>
              <Avatar id={e.id} size={30} />
              <div className="grow">
                <div className="row row-wrap" style={{ gap: 6 }}><b>{e.name}</b>{isAway(e) ? <AwayTag id={e.id} /> : <span className="away-tag is-soon">From {leaveText(e)}</span>}</div>
                {e.awayNote && <div className="tiny muted">{e.awayNote}</div>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(e.id)}>Edit</button>
            </div>
            {list.length === 0 && <div className="small muted away-none">Nothing due during the leave.</div>}
            {list.map((t) => (
              <div key={t.id} className="away-task">
                <button className="grow away-task-title" onClick={() => openTask(t.id)}>
                  <span className="strong truncate">{t.title}</span>
                  <span className="task-meta">{t.clientId ? <ClientTag clientId={t.clientId} /> : 'Internal'}<span className="sep" /><Due date={t.due} /></span>
                </button>
                {canEditTask(user, t, employees) && (
                  <select className="select select-sm" value="" onChange={(ev) => give(t, ev.target.value)} aria-label={`Give "${t.title}" to someone else`}>
                    <option value="">Give to…</option>
                    <PeopleOptions employees={employees.filter((x) => x.id !== e.id)} meId={user.id} />
                  </select>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <AwayForm personId={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

const WEEK = 7 * 86400000
const RANK = { admin: 0, head: 1, member: 2 }

export default function Team() {
  const user = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const [date, setDate] = useState(todayIso())
  const [view, setView] = useState('people')
  const [open, setOpen] = useState(null)
  const [dep, setDep] = useState('')
  const [leaveFor, setLeaveFor] = useState(null)

  const people = useMemo(() => {
    const ids = new Set(teamIds(user, employees))
    return employees.filter((e) => e.active && ids.has(e.id) && e.role !== 'admin' && (!dep || e.department === dep))
  }, [employees, user, dep])

  const rows = useMemo(() => people.map((e) => {
    const myClients = clients.filter((c) => c.active && c.memberIds?.includes(e.id))
    const ups = updates.filter((u) => u.employeeId === e.id && u.date === date)
    const mine = tasks.filter((t) => t.assigneeId === e.id)
    const openT = mine.filter((t) => t.status === 'todo' || t.status === 'doing')
    return {
      e, myClients, ups,
      updated: ups.filter((u) => u.clientId && myClients.some((c) => c.id === u.clientId)).length,
      open: openT.length,
      review: mine.filter((t) => t.status === 'review').length,
      overdueList: mine.filter((t) => t.status !== 'done' && (daysUntil(t.due) ?? 1) < 0),
      waiting: mine.filter((t) => t.status === 'waiting').length,
      done7: mine.filter((t) => t.status === 'done' && (t.completedAt ?? 0) > Date.now() - WEEK).length,
    }
  }).sort((a, b) => DEPARTMENTS.indexOf(a.e.department) - DEPARTMENTS.indexOf(b.e.department) || RANK[a.e.role] - RANK[b.e.role] || a.e.name.localeCompare(b.e.name)), [people, clients, updates, tasks, date])

  const totals = {
    reported: rows.filter((r) => r.ups.length > 0).length,
    overdue: rows.reduce((n, r) => n + r.overdueList.length, 0),
    waiting: rows.reduce((n, r) => n + r.waiting, 0),
    done7: rows.reduce((n, r) => n + r.done7, 0),
  }

  const sheet = useMemo(() => {
    const ids = new Set(people.map((p) => p.id))
    return updates.filter((u) => u.date === date && ids.has(u.employeeId))
      .sort((a, b) => rows.findIndex((r) => r.e.id === a.employeeId) - rows.findIndex((r) => r.e.id === b.employeeId))
  }, [updates, date, people, rows])

  const isToday = date === todayIso()

  return (
    <PageMotion>
      <div className="page-head">
        <div><h1>Team</h1><p className="page-sub">Who has updated, what is late, and what is waiting on clients.</p></div>
        <div className="row month-nav">
          <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(-1, new Date(`${date}T12:00:00`)))}><ChevronLeft /></button>
          <b style={{ minWidth: 150, textAlign: 'center' }}>{isToday ? 'Today' : formatDate(date)}</b>
          <button className="icon-btn" aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(1, new Date(`${date}T12:00:00`)))}><ChevronRight /></button>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat"><div className="stat-label"><PenLine />Sent an update</div><div className="stat-value">{totals.reported}<span className="stat-of">/{rows.length}</span></div><div className="stat-foot">{isToday ? 'today' : formatDate(date)}</div></div>
        <div className={`card stat ${totals.overdue ? 'is-alert' : ''}`}><div className="stat-label"><TriangleAlert />Overdue tasks</div><div className="stat-value">{totals.overdue}</div><div className="stat-foot">right now</div></div>
        <div className="card stat"><div className="stat-label"><Hourglass />Waiting on client</div><div className="stat-value">{totals.waiting}</div><div className="stat-foot">approvals and inputs</div></div>
        <div className="card stat"><div className="stat-label"><CircleCheck />Done this week</div><div className="stat-value">{totals.done7}</div><div className="stat-foot">last 7 days</div></div>
      </div>

      <div className="toolbar">
        <div className="seg">
          <button className={view === 'people' ? 'on' : ''} onClick={() => setView('people')}>By person</button>
          <button className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}>Daily sheet</button>
        </div>
        <select className="select select-sm" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.filter((d) => d !== 'Management').map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>

      <AwaySection people={people} />

      {rows.length === 0 && <div className="card"><Empty icon={Users} title="No one in this view" /></div>}

      {view === 'people' && rows.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Update</th><th>To do</th><th>In review</th><th>Overdue</th><th>Waiting</th><th>Done (7d)</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.e.id}>
                  <tr className="click-row" onClick={() => setOpen(open === r.e.id ? null : r.e.id)}>
                    <td><div className="row" style={{ gap: 10 }}><Avatar id={r.e.id} size={30} /><div><div className="row" style={{ gap: 6 }}><b>{r.e.name}</b><AwayTag id={r.e.id} /></div><div className="tiny muted">{r.e.title}</div></div></div></td>
                    <td>{r.ups.length === 0
                      ? <span className="badge tone-red">Not yet</span>
                      : <span className={`badge ${r.updated >= r.myClients.length ? 'tone-green' : 'tone-amber'}`}>{r.myClients.length ? `${r.updated} of ${r.myClients.length} clients` : `${r.ups.length} update${r.ups.length > 1 ? 's' : ''}`}</span>}</td>
                    <td>{r.open}</td>
                    <td>{r.review}</td>
                    <td>{r.overdueList.length ? <b style={{ color: 'var(--red)' }}>{r.overdueList.length}</b> : 0}</td>
                    <td>{r.waiting}</td>
                    <td>{r.done7}</td>
                    <td style={{ textAlign: 'right' }}><ChevronDown size={16} className={`chev ${open === r.e.id ? 'up' : ''}`} /></td>
                  </tr>
                  {open === r.e.id && (
                    <tr className="expand-row"><td colSpan={8}>
                      <div className="grid grid-2">
                        <div>
                          <div className="section-title" style={{ marginBottom: 6 }}>Updates · {isToday ? 'today' : formatDate(date)}</div>
                          {r.ups.length === 0 && <div className="muted small">No update yet.</div>}
                          {r.ups.map((u) => (
                            <div key={u.id} className="log-item">
                              <span style={{ minWidth: 130 }} className="small">{u.clientId ? <ClientTag clientId={u.clientId} /> : <span className="muted">Internal</span>}</span>
                              <span className="soft">{u.text}</span>
                            </div>
                          ))}
                          {r.myClients.filter((c) => !r.ups.some((u) => u.clientId === c.id)).length > 0 && (
                            <div className="tiny muted mt-8">No update for: {r.myClients.filter((c) => !r.ups.some((u) => u.clientId === c.id)).map((c) => c.name).join(', ')}</div>
                          )}
                        </div>
                        <div>
                          <div className="section-title row between" style={{ marginBottom: 6 }}>Overdue <Link className="link tiny" to={`/tasks?person=${r.e.id}&show=all`}>All their tasks →</Link></div>
                          {r.overdueList.length === 0 ? <div className="muted small">Nothing overdue.</div> : r.overdueList.map((t) => <TaskRow key={t.id} task={t} />)}
                          <button className="btn btn-ghost btn-sm mt-8" onClick={() => setLeaveFor(r.e.id)}><Plane />{hasLeave(r.e) && r.e.awayTo >= todayIso() ? `Leave ${leaveText(r.e)} · edit` : 'Mark on leave'}</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'sheet' && rows.length > 0 && (
        <div className="card table-wrap">
          <table className="table sheet">
            <thead><tr><th style={{ width: 170 }}>Person</th><th style={{ width: 200 }}>Client</th><th>Update · {isToday ? 'today' : formatDate(date)}</th></tr></thead>
            <tbody>
              {sheet.length === 0 && <tr><td colSpan={3}><span className="muted">No updates for this day.</span></td></tr>}
              {sheet.map((u, i) => (
                <tr key={u.id}>
                  <td>{(i === 0 || sheet[i - 1].employeeId !== u.employeeId) && <span className="row" style={{ gap: 8 }}><Avatar id={u.employeeId} size={22} /><b>{employees.find((e) => e.id === u.employeeId)?.name}</b></span>}</td>
                  <td>{u.clientId ? <Link to={`/clients/${u.clientId}`}><ClientTag clientId={u.clientId} /></Link> : <span className="muted">Internal</span>}</td>
                  <td className="soft">{u.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.filter((r) => r.ups.length === 0).length > 0 && (
            <div className="small muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
              No update yet from: {rows.filter((r) => r.ups.length === 0).map((r) => r.e.name).join(', ')}
            </div>
          )}
        </div>
      )}
      <AwayForm personId={leaveFor} onClose={() => setLeaveFor(null)} />
    </PageMotion>
  )
}
