import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, TriangleAlert, Eye, CircleCheck, Inbox, Hourglass, Send, PartyPopper, Plus } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { scopeIds } from '../lib/permissions'
import { daysUntil, greeting, relTime } from '../lib/date'
import { Avatar, ClientTag, Due, Empty, PageMotion, StatusBadge, TaskRow } from '../components/ui'

const GROUPS = [
  { id: 'overdue', label: 'Overdue', test: (n) => n !== null && n < 0 },
  { id: 'today', label: 'Today', test: (n) => n === 0 },
  { id: 'week', label: 'Next 7 days', test: (n) => n !== null && n > 0 && n <= 7 },
  { id: 'later', label: 'Later', test: (n) => n === null || n > 7 },
]

function Stat({ icon: Icon, label, value, foot, alert, delay }) {
  return (
    <motion.div className={`card stat ${alert && value > 0 ? 'is-alert' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <div className="stat-label"><Icon />{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{foot}</div>
    </motion.div>
  )
}

// compact task line for the side cards
function MiniTask({ task, person, verb, extra }) {
  const openTask = useStore((s) => s.openTask)
  const e = useStore((s) => s.employees.find((x) => x.id === person))
  return (
    <button className="feed-item" onClick={() => openTask(task.id)}>
      <Avatar id={person} size={30} />
      <div className="grow">
        <div className="strong truncate">{task.title}</div>
        <div className="task-meta">
          <span>{verb} {e?.name ?? 'someone'}</span>
          {task.clientId && (<><span className="sep" /><ClientTag clientId={task.clientId} /></>)}
        </div>
        {extra}
      </div>
      <Due date={task.due} done={task.status === 'done'} />
    </button>
  )
}

export default function Home() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const openNewTask = useStore((s) => s.openNewTask)
  const [view, setView] = useState('open')

  const d = useMemo(() => {
    const mine = tasks.filter((t) => t.assigneeId === user.id)
    const open = mine.filter((t) => t.status !== 'done').sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
    const done = mine.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    const weekAgo = Date.now() - 7 * 86400000
    const scope = new Set(scopeIds(user, employees))
    const fresh = open.filter((t) => t.assignedById !== user.id && t.createdAt > Date.now() - 4 * 86400000).sort((a, b) => b.createdAt - a.createdAt)
    const blockedOnMe = tasks.filter((t) => t.blocked?.onId === user.id && t.status !== 'done')
    const toReview = user.role === 'employee' ? [] : tasks.filter((t) => t.status === 'review' && t.assigneeId !== user.id && (t.assignedById === user.id || scope.has(t.assigneeId)))
    const delegated = tasks.filter((t) => t.assignedById === user.id && t.assigneeId !== user.id && t.status !== 'done').sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
    return {
      open, done, fresh, blockedOnMe, toReview, delegated,
      dueToday: open.filter((t) => daysUntil(t.due) === 0).length,
      overdue: open.filter((t) => (daysUntil(t.due) ?? 1) < 0).length,
      inReview: open.filter((t) => t.status === 'review').length,
      doneWeek: done.filter((t) => (t.completedAt ?? 0) > weekAgo).length,
    }
  }, [tasks, employees, user])

  const groups = GROUPS.map((g) => ({ ...g, items: d.open.filter((t) => g.test(daysUntil(t.due))) })).filter((g) => g.items.length)
  const waiting = d.blockedOnMe.length + d.toReview.length
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const summary = d.overdue
    ? `${d.overdue} overdue and ${d.dueToday} due today.`
    : d.dueToday ? `${d.dueToday} task${d.dueToday > 1 ? 's' : ''} due today.` : 'Nothing due today — you’re on track.'

  return (
    <PageMotion>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="page-sub">{today} · {summary}</p>
        </div>
        <button className="btn" onClick={() => openNewTask()}><Plus />Add a task</button>
      </div>

      <div className="grid grid-4">
        <Stat icon={CalendarClock} label="Due today" value={d.dueToday} foot={`${d.open.length} open in total`} delay={0} />
        <Stat icon={TriangleAlert} label="Overdue" value={d.overdue} foot={d.overdue ? 'Needs attention first' : 'Nothing late'} alert delay={0.05} />
        <Stat icon={Hourglass} label="Waiting on you" value={waiting} foot={user.role === 'employee' ? 'Teammates blocked on you' : 'Reviews + blockers'} delay={0.1} />
        <Stat icon={CircleCheck} label="Done this week" value={d.doneWeek} foot="Last 7 days" delay={0.15} />
      </div>

      <div className="grid home-cols" style={{ gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h2>My tasks</h2>
            <div className="seg">
              <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>Open · {d.open.length}</button>
              <button className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Done · {d.done.length}</button>
            </div>
          </div>
          <div style={{ padding: '4px 8px 12px' }}>
            {view === 'open' && groups.length === 0 && <Empty icon={PartyPopper} title="All clear" text="You have no open tasks right now." />}
            {view === 'open' && groups.map((g) => (
              <div key={g.id}>
                <div className="group-head">
                  <span className="section-title" style={g.id === 'overdue' ? { color: 'var(--red)' } : undefined}>{g.label}</span>
                  <span className="count">{g.items.length}</span>
                </div>
                <AnimatePresence initial={false}>
                  {g.items.map((t) => <TaskRow key={t.id} task={t} />)}
                </AnimatePresence>
              </div>
            ))}
            {view === 'done' && (d.done.length === 0
              ? <Empty icon={CircleCheck} title="Nothing completed yet" />
              : <div style={{ paddingTop: 8 }}>{d.done.map((t) => <TaskRow key={t.id} task={t} />)}</div>)}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h2 className="row"><Inbox size={16} />Newly assigned to you</h2><span className="muted small">{d.fresh.length}</span></div>
            <div style={{ padding: '6px 10px 10px' }}>
              {d.fresh.length === 0 && <div className="muted small" style={{ padding: '10px 8px' }}>No new assignments in the last few days.</div>}
              {d.fresh.slice(0, 5).map((t) => <MiniTask key={t.id} task={t} person={t.assignedById} verb={`${relTime(t.createdAt)} · from`} />)}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2 className="row"><Hourglass size={16} />Waiting on you</h2><span className="muted small">{waiting}</span></div>
            <div style={{ padding: '6px 10px 10px' }}>
              {waiting === 0 && <div className="muted small" style={{ padding: '10px 8px' }}>Nobody is waiting on you. Nice.</div>}
              {d.blockedOnMe.map((t) => (
                <MiniTask key={t.id} task={t} person={t.assigneeId} verb="Blocking"
                  extra={t.blocked.reason && <div className="small" style={{ color: 'var(--red)', marginTop: 3 }}>{t.blocked.reason}</div>} />
              ))}
              {d.toReview.map((t) => (
                <MiniTask key={t.id} task={t} person={t.assigneeId} verb="Review for"
                  extra={<div className="mt-4"><span className="badge tone-amber"><Eye />Needs your review</span></div>} />
              ))}
            </div>
          </div>

          {d.delegated.length > 0 && (
            <div className="card">
              <div className="card-head"><h2 className="row"><Send size={16} />You assigned</h2><span className="muted small">{d.delegated.length} open</span></div>
              <div style={{ padding: '6px 10px 10px' }}>
                {d.delegated.slice(0, 6).map((t) => (
                  <MiniTask key={t.id} task={t} person={t.assigneeId} verb="With"
                    extra={<div className="row mt-4"><StatusBadge status={t.status} />{t.blocked && <span className="badge tone-red">Blocked</span>}</div>} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageMotion>
  )
}
