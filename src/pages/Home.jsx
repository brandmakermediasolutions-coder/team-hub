import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { PartyPopper, Plus, PenLine, Send, Check, CircleCheck, Hourglass, Users, ArrowRight } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { isLead, teamIds } from '../lib/permissions'
import { daysUntil, greeting, shortDate, todayIso } from '../lib/date'
import { Avatar, Due, Empty, PageMotion, StatusBadge, TaskRow } from '../components/ui'

const GROUPS = [
  { id: 'overdue', label: 'Overdue', test: (n) => n !== null && n < 0 },
  { id: 'today', label: 'Today', test: (n) => n === 0 },
  { id: 'soon', label: 'Coming up', test: (n) => n !== null && n > 0 },
  { id: 'nodate', label: 'No date', test: (n) => n === null },
]

// one line per client for today's update; saves when you click away
export function UpdateBox({ clientId, label, color, date = todayIso() }) {
  const user = useCurrentUser()
  const saveUpdate = useStore((s) => s.saveUpdate)
  const id = `U-${date}-${user.id}-${clientId ?? 'general'}`
  const existing = useStore((s) => s.updates.find((u) => u.id === id))
  const last = useStore((s) => s.updates
    .filter((u) => u.employeeId === user.id && (u.clientId ?? null) === (clientId ?? null) && u.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0])
  const [text, setText] = useState(existing?.text ?? '')
  const [saved, setSaved] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setText(existing?.text ?? '') }, [existing?.text])
  // grow the box to fit the text
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`
  }, [text])

  const commit = () => {
    if (text.trim() === (existing?.text ?? '')) return
    saveUpdate(clientId, text, date)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }
  return (
    <div className={`update-row ${existing ? 'has' : ''}`}>
      <div className="update-client">
        <span className="client-dot" style={{ background: color ?? 'var(--line-strong)' }} />
        {clientId ? <Link to={`/clients/${clientId}`} className="truncate strong">{label}</Link> : <span className="truncate strong">{label}</span>}
        {saved ? <span className="saved"><Check size={12} />Saved</span> : existing && <CircleCheck size={14} className="done-mark" />}
      </div>
      <textarea ref={ref} className="textarea update-input" rows={1} value={text}
        placeholder={last ? `Last (${shortDate(last.date)}): ${last.text}` : 'What happened today? One line is enough.'}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }} />
    </div>
  )
}

export default function Home() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const clients = useStore((s) => s.clients)
  const updates = useStore((s) => s.updates)
  const createTask = useStore((s) => s.createTask)
  const openNewTask = useStore((s) => s.openNewTask)
  const [view, setView] = useState('open')
  const [quick, setQuick] = useState('')

  const d = useMemo(() => {
    const mine = tasks.filter((t) => t.assigneeId === user.id)
    const byDue = (a, b) => (a.due ?? '9').localeCompare(b.due ?? '9') || Number(b.urgent) - Number(a.urgent)
    const open = mine.filter((t) => t.status === 'todo' || t.status === 'doing').sort(byDue)
    const waiting = mine.filter((t) => t.status === 'waiting').sort(byDue)
    const done = mine.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 30)
    const gave = tasks.filter((t) => t.assignedById === user.id && t.assigneeId !== user.id && t.status !== 'done').sort(byDue)
    return {
      open, waiting, done, gave,
      overdue: open.filter((t) => (daysUntil(t.due) ?? 1) < 0).length,
      dueToday: open.filter((t) => daysUntil(t.due) === 0).length,
    }
  }, [tasks, user.id])

  const myClients = useMemo(() => clients.filter((c) => c.active && c.memberIds?.includes(user.id)).sort((a, b) => a.name.localeCompare(b.name)), [clients, user.id])
  const today = todayIso()
  const updatedCount = updates.filter((u) => u.employeeId === user.id && u.date === today && u.clientId && myClients.some((c) => c.id === u.clientId)).length

  const list = view === 'open' ? d.open : view === 'waiting' ? d.waiting : d.done
  const groups = view === 'open' ? GROUPS.map((g) => ({ ...g, items: d.open.filter((t) => g.test(daysUntil(t.due))) })).filter((g) => g.items.length) : null
  const summary = d.overdue ? `${d.overdue} overdue, ${d.dueToday} due today.` : d.dueToday ? `${d.dueToday} due today.` : 'Nothing due today.'

  const addQuick = (e) => {
    e.preventDefault()
    if (!quick.trim()) return
    createTask({ title: quick, due: today })
    setQuick('')
  }

  return (
    <PageMotion>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="page-sub">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {summary}</p>
        </div>
      </div>

      <div className="home-cols">
        <div className="card">
          <div className="card-head">
            <h2>My tasks</h2>
            <div className="seg">
              <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>To do · {d.open.length}</button>
              <button className={view === 'waiting' ? 'on' : ''} onClick={() => setView('waiting')}>Waiting on client · {d.waiting.length}</button>
              <button className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Done</button>
            </div>
          </div>
          <form className="quick-add" onSubmit={addQuick}>
            <Plus size={16} />
            <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a task for yourself and press Enter (due today)" aria-label="Quick add task" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openNewTask()}>More options</button>
          </form>
          <div style={{ padding: '0 8px 12px' }}>
            {list.length === 0 && (view === 'open'
              ? <Empty icon={PartyPopper} title="All clear" text="Nothing on your list right now." />
              : <Empty icon={view === 'waiting' ? Hourglass : CircleCheck} title={view === 'waiting' ? 'Nothing waiting on clients' : 'Nothing completed yet'} />)}
            {groups ? groups.map((g) => (
              <div key={g.id}>
                <div className="group-head">
                  <span className="section-title" style={g.id === 'overdue' ? { color: 'var(--red)' } : undefined}>{g.label}</span>
                  <span className="count">{g.items.length}</span>
                </div>
                <AnimatePresence initial={false}>{g.items.map((t) => <TaskRow key={t.id} task={t} />)}</AnimatePresence>
              </div>
            )) : <div style={{ paddingTop: 6 }}>{list.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="row"><PenLine size={16} />Today's update</h2>
              {myClients.length > 0 && <span className={`badge ${updatedCount === myClients.length ? 'tone-green' : 'tone-grey'}`}>{updatedCount} of {myClients.length} done</span>}
            </div>
            <p className="muted small" style={{ padding: '4px 20px 0' }}>One line per client. It saves by itself.</p>
            <div className="update-list">
              {myClients.map((c) => <UpdateBox key={c.id} clientId={c.id} label={c.name} color={c.color} />)}
              <UpdateBox clientId={null} label="Other / internal work" />
            </div>
          </div>

          {isLead(user) && <TeamSnapshot />}

          {d.gave.length > 0 && (
            <div className="card">
              <div className="card-head"><h2 className="row"><Send size={16} />Tasks I gave others</h2><span className="muted small">{d.gave.length} open</span></div>
              <div style={{ padding: '6px 10px 10px' }}>
                {d.gave.slice(0, 8).map((t) => <GaveRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageMotion>
  )
}

function GaveRow({ task }) {
  const openTask = useStore((s) => s.openTask)
  const e = useStore((s) => s.employees.find((x) => x.id === task.assigneeId))
  return (
    <button className="feed-item" onClick={() => openTask(task.id)}>
      <Avatar id={task.assigneeId} size={28} />
      <div className="grow">
        <div className="strong truncate">{task.title}</div>
        <div className="task-meta"><span>{e?.name}</span><span className="sep" /><StatusBadge status={task.status} /></div>
      </div>
      <Due date={task.due} />
    </button>
  )
}

function TeamSnapshot() {
  const user = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const today = todayIso()
  const ids = new Set(teamIds(user, employees).filter((id) => id !== user.id))
  const people = employees.filter((e) => e.active && ids.has(e.id))
  const reported = new Set(updates.filter((u) => u.date === today && ids.has(u.employeeId)).map((u) => u.employeeId))
  const missing = people.filter((p) => !reported.has(p.id))
  const overdue = tasks.filter((t) => ids.has(t.assigneeId) && t.status !== 'done' && (daysUntil(t.due) ?? 1) < 0).length
  if (!people.length) return null
  return (
    <Link to="/team" className="card card-hover" style={{ display: 'block' }}>
      <div className="card-head"><h2 className="row"><Users size={16} />My team today</h2><ArrowRight size={16} className="muted" /></div>
      <div className="card-body stack" style={{ gap: 8 }}>
        <div className="row row-wrap" style={{ gap: 6 }}>
          <span className={`badge ${missing.length ? 'tone-amber' : 'tone-green'}`}>{reported.size} of {people.length} sent updates</span>
          {overdue > 0 && <span className="badge tone-red">{overdue} overdue</span>}
        </div>
        {missing.length > 0 && <div className="small muted">Not yet: {missing.map((p) => p.name.split(' ')[0]).join(', ')}</div>}
      </div>
    </Link>
  )
}
