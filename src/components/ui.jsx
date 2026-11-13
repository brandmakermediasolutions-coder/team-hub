import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Calendar, Check, Flame, Repeat, Plane, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import { STATUSES } from '../store/seed'
import { dueInfo } from '../lib/date'
import { awayDuring, awayLabel, isAway, leaveText } from '../lib/repeat'

/*
  Shared UI building blocks.
    <Avatar id size />  <AvatarStack ids max />  <StatusBadge status />  <Urgent />
    <Due date done />   <ClientTag clientId />   <Modal open onClose title footer>…</Modal>
    <Empty icon title text />  <Field label hint>…</Field>  <PageMotion>…</PageMotion>
    <TaskRow task showAssignee />  (click opens the task drawer; round tick completes it)
    <AwayTag id />  ("Away till 18 Nov" while someone is on leave)   <RepeatMark />   <LeaveWarning personId due />
*/

const initials = (name = '?') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export function Avatar({ id, size = 32, title }) {
  const e = useStore((s) => s.employees.find((x) => x.id === id))
  const away = isAway(e)
  return (
    <span className={`avatar ${away ? 'is-away' : ''}`} style={{ '--size': `${size}px`, background: e?.color ?? '#9aa0aa' }}
      title={title ?? (e ? `${e.name}${away ? ` · ${awayLabel(e)}` : ''}` : 'Unknown')}>
      {initials(e?.name)}
    </span>
  )
}

export function AwayTag({ id }) {
  const e = useStore((s) => s.employees.find((x) => x.id === id))
  if (!isAway(e)) return null
  return <span className="away-tag" title={e.awayNote || undefined}><Plane />{awayLabel(e)}</span>
}

export const RepeatMark = ({ label = true }) => <span className="repeat-mark" title="Repeating task"><Repeat />{label && 'Repeats'}</span>

// "Jesika is away 14 – 18 Nov" when a task for them is due during their leave
export function LeaveWarning({ personId, due }) {
  const e = useStore((s) => s.employees.find((x) => x.id === personId))
  if (!e || !(awayDuring(e, due) || (!due && isAway(e)))) return null
  return (
    <div className="note-line is-warn"><TriangleAlert size={14} />
      <span>{e.name.split(' ')[0]} is on leave {leaveText(e)}{e.awayNote ? ` (${e.awayNote})` : ''}{due ? ', and this is due during it.' : '.'}</span>
    </div>
  )
}

export function AvatarStack({ ids = [], max = 4, size = 26 }) {
  const shown = ids.slice(0, max)
  return (
    <span className="avatar-stack">
      {shown.map((id) => <Avatar key={id} id={id} size={size} />)}
      {ids.length > max && <span className="avatar avatar-more" style={{ '--size': `${size}px` }}>+{ids.length - max}</span>}
    </span>
  )
}

export const STATUS_TONE = { todo: 'tone-grey', doing: 'tone-blue', review: 'tone-violet', waiting: 'tone-amber', done: 'tone-green' }
export const STATUS_COLOR = { todo: 'var(--grey)', doing: 'var(--blue)', review: 'var(--violet)', waiting: 'var(--amber)', done: 'var(--green)' }

export function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.id === status)
  return <span className={`badge ${STATUS_TONE[status] ?? ''}`}><span className="dot" />{s?.label ?? status}</span>
}

export const Urgent = () => <span className="badge tone-red"><Flame />Urgent</span>

export function Due({ date, done }) {
  const { label, tone } = dueInfo(date, done)
  return <span className={`due ${tone}`}><Calendar />{label}</span>
}

export function ClientTag({ clientId }) {
  const c = useStore((s) => s.clients.find((x) => x.id === clientId))
  if (!c) return null
  return <span className="row" style={{ gap: 6, minWidth: 0 }}><span className="client-dot" style={{ background: c.color }} /><span className="truncate">{c.name}</span></span>
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon /></div>}
      <b>{title}</b>
      {text && <span className="small">{text}</span>}
      {children}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, width }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" style={{ zIndex: 59 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="modal-wrap">
            <motion.div
              className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}
              initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div className="modal-head">
                <h2>{title}</h2>
                <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
              </div>
              <div className="modal-body">{children}</div>
              {footer && <div className="modal-foot">{footer}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export function PageMotion({ children, className = 'page' }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

export function TaskRow({ task, showAssignee = false, showAssigner = true, showClient = true }) {
  const openTask = useStore((s) => s.openTask)
  const updateTask = useStore((s) => s.updateTask)
  const assigner = useStore((s) => s.employees.find((e) => e.id === task.assignedById))
  const assignee = useStore((s) => s.employees.find((e) => e.id === task.assigneeId))
  const done = task.status === 'done'
  return (
    <motion.div layout="position" className={`task-row ${done ? 'is-done' : ''}`} role="button" tabIndex={0}
      onClick={() => openTask(task.id)} onKeyDown={(e) => e.key === 'Enter' && openTask(task.id)}>
      <button className={`tick ${done ? 'on' : ''}`} aria-label={done ? 'Mark as not done' : 'Mark as done'}
        onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: done ? 'todo' : 'done' }) }}><Check /></button>
      <div style={{ minWidth: 0 }}>
        <div className="task-title truncate">{task.title}</div>
        <div className="task-meta">
          {[
            showClient && task.clientId && <ClientTag key="c" clientId={task.clientId} />,
            showAssignee && assignee && <span key="a" className="row" style={{ gap: 5 }}><Avatar id={assignee.id} size={16} />{assignee.name}<AwayTag id={assignee.id} /></span>,
            showAssigner && assigner && task.assignedById !== task.assigneeId && <span key="f">from {assigner.name.split(' ')[0]}</span>,
            task.repeatRuleId && <RepeatMark key="r" />,
          ].filter(Boolean).flatMap((el, i) => (i ? [<span key={`s${i}`} className="sep" />, el] : [el]))}
        </div>
      </div>
      <div className="row task-right" style={{ gap: 8 }}>
        {!done && task.urgent && <Urgent />}
        {!done && task.status !== 'todo' && <StatusBadge status={task.status} />}
        <Due date={task.due} done={done} />
      </div>
    </motion.div>
  )
}
