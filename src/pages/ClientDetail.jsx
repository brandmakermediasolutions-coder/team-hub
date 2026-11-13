import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, ListChecks, PenLine, ChevronLeft, ChevronRight, Info, LayoutList } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { canManageClients, canSeePostCalendar } from '../lib/permissions'
import { dayHeading, monthLabel, shiftMonth, todayIso } from '../lib/date'
import { Avatar, AwayTag, Empty, PageMotion, TaskRow } from '../components/ui'
import ClientForm from '../components/ClientForm'
import TemplatePicker from '../components/TemplatePicker'
import { PostGrid, Legend } from './PostCalendar'
import { UpdateBox } from './Home'

export default function ClientDetail() {
  const { id } = useParams()
  const user = useCurrentUser()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const employees = useStore((s) => s.employees)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const openNewTask = useStore((s) => s.openNewTask)
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [month, setMonth] = useState(todayIso().slice(0, 8) + '01')

  const mine = useMemo(() => tasks.filter((t) => t.clientId === id).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')), [tasks, id])
  const open = mine.filter((t) => t.status !== 'done')
  const done = mine.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const log = useMemo(() => {
    const g = {}
    updates.filter((u) => u.clientId === id).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).forEach((u) => (g[u.date] ??= []).push(u))
    return Object.entries(g).slice(0, 14)
  }, [updates, id])

  if (!client) return <div className="page"><Empty title="Client not found" text="It may have been removed."><Link className="btn mt-8" to="/clients">Back to clients</Link></Empty></div>

  const team = [client.ownerId, ...(client.memberIds ?? []).filter((m) => m !== client.ownerId)].map((pid) => employees.find((e) => e.id === pid)).filter(Boolean)
  const onTeam = client.memberIds?.includes(user.id)

  return (
    <PageMotion>
      <Link to="/clients" className="row small muted back-link"><ArrowLeft size={14} />All clients</Link>
      <div className="page-head">
        <div className="row" style={{ gap: 14 }}>
          <span className="client-mark lg" style={{ background: client.color }}>{client.name.replace(/^the /i, '')[0]}</span>
          <div>
            <h1>{client.name}{!client.active && <span className="badge tone-grey" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Paused</span>}</h1>
            <p className="page-sub">{client.services.join(' · ') || 'No services set'}</p>
          </div>
        </div>
        <div className="row row-wrap">
          {canManageClients(user) && <button className="btn" onClick={() => setEditing(true)}><Pencil />Edit</button>}
          <button className="btn" onClick={() => setPicking(true)}><LayoutList />Use a template</button>
          <button className="btn btn-primary" onClick={() => openNewTask({ clientId: client.id })}><Plus />New task</button>
        </div>
      </div>

      <div className="grid client-top">
        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div className="section-title">Team</div>
          {team.map((e) => (
            <div key={e.id} className="row" style={{ gap: 10 }}>
              <Avatar id={e.id} size={28} />
              <div className="grow"><div className="strong row row-wrap" style={{ gap: 6 }}>{e.name}{e.id === client.ownerId && <span className="badge tone-accent">Account manager</span>}<AwayTag id={e.id} /></div><div className="tiny muted">{e.title}</div></div>
              <Link className="btn btn-ghost btn-sm" to={`/tasks?person=${e.id}&client=${client.id}`}>Tasks</Link>
            </div>
          ))}
        </div>
        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div className="section-title">Scope</div>
          <div><span className="muted small">Monthly deliverables</span><div>{client.deliverables || <span className="muted">Not set</span>}</div></div>
          <div><span className="muted small">Ads</span><div>{client.ads || <span className="muted">None</span>}</div></div>
          {client.brief && <div className="brief"><Info size={14} />{client.brief}</div>}
        </div>
      </div>

      <div className="home-cols">
        <div className="card">
          <div className="card-head">
            <h2 className="row"><ListChecks size={16} />Tasks</h2>
            <div className="seg">
              <button className={!showDone ? 'on' : ''} onClick={() => setShowDone(false)}>Open · {open.length}</button>
              <button className={showDone ? 'on' : ''} onClick={() => setShowDone(true)}>Done · {done.length}</button>
            </div>
          </div>
          <div style={{ padding: '6px 8px 12px' }}>
            {(showDone ? done : open).length === 0
              ? <Empty icon={ListChecks} title={showDone ? 'Nothing done yet' : 'No open tasks'} />
              : (showDone ? done : open).map((t) => <TaskRow key={t.id} task={t} showAssignee showClient={false} />)}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="row"><PenLine size={16} />Daily updates</h2></div>
          {onTeam && <div className="update-list" style={{ paddingTop: 6 }}><UpdateBox clientId={client.id} label="Your update today" color={client.color} /></div>}
          <div style={{ padding: '6px 20px 16px' }}>
            {log.length === 0 && <div className="muted small" style={{ padding: '8px 0' }}>No updates in the last 90 days.</div>}
            {log.map(([date, list]) => (
              <div key={date} className="log-day">
                <div className="section-title">{dayHeading(new Date(`${date}T12:00:00`).getTime())}</div>
                {list.map((u) => (
                  <div key={u.id} className="log-item">
                    <Avatar id={u.employeeId} size={22} />
                    <div><b>{employees.find((e) => e.id === u.employeeId)?.name.split(' ')[0]}</b> <span className="soft">{u.text}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {client.services.includes('Social Media') && canSeePostCalendar(user) && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head" style={{ paddingBottom: 12 }}>
            <h2>Post calendar</h2>
            <div className="row month-nav">
              <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></button>
              <b style={{ minWidth: 120, textAlign: 'center' }}>{monthLabel(month)}</b>
              <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></button>
            </div>
          </div>
          <div style={{ padding: '0 20px 12px' }}><Legend /></div>
          <PostGrid clients={[client]} month={month} groupBy={false} />
        </div>
      )}

      <ClientForm open={editing} client={client} onClose={() => setEditing(false)} />
      <TemplatePicker open={picking} client={client} onClose={() => setPicking(false)} />
    </PageMotion>
  )
}
