import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Calendar, Check, Ban } from 'lucide-react'
import { useStore } from '../store/useStore'
import { STATUSES, PRIORITIES } from '../store/seed'
import { dueInfo } from '../lib/date'

/*
  Shared UI building blocks. Import from '../components/ui'.
    <Avatar id="BM-003" size={28} />            <AvatarStack ids={[...]} max={4} />
    <StatusBadge status="review" />             <PriorityBadge priority="high" />
    <Due date="2026-11-14" done={false} />      <ClientTag clientId="C-01" />
    <Modal open onClose title footer>…</Modal>  <Empty icon={Icon} title text />
    <Field label hint>…</Field>                 <PageMotion>…</PageMotion>
    <TaskRow task={task} showAssignee />        (click opens the task drawer)
*/

const initials = (name = '?') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export function Avatar({ id, size = 32, title }) {
  const e = useStore((s) => s.employees.find((x) => x.id === id))
  return (
    <span className="avatar" style={{ '--size': `${size}px`, background: e?.color ?? '#9aa0aa' }} title={title ?? e?.name ?? 'Unknown'}>
      {initials(e?.name)}
    </span>
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

const STATUS_TONE = { todo: 'tone-grey', progress: 'tone-blue', review: 'tone-amber', done: 'tone-green' }
export const STATUS_COLOR = { todo: 'var(--grey)', progress: 'var(--blue)', review: 'var(--amber)', done: 'var(--green)' }
export function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.id === status)
  return <span className={`badge ${STATUS_TONE[status] ?? ''}`}><span className="dot" />{s?.label ?? status}</span>
}

const PRIO_TONE = { urgent: 'tone-red', high: 'tone-amber', medium: 'tone-blue', low: 'tone-grey' }
export function PriorityBadge({ priority }) {
  const p = PRIORITIES.find((x) => x.id === priority)
  return <span className={`badge ${PRIO_TONE[priority] ?? ''}`}>{p?.label ?? priority}</span>
}

export function Due({ date, done }) {
  const { label, tone } = dueInfo(date, done)
  return <span className={`due ${tone}`}><Calendar />{label}</span>
}

export function ClientTag({ clientId }) {
  const c = useStore((s) => s.clients.find((x) => x.id === clientId))
  if (!c) return null
  return <span className="row gap-4" style={{ gap: 6 }}><span className="client-dot" style={{ background: c.color }} /><span className="truncate">{c.name}</span></span>
}

export function BlockedNote({ blocked }) {
  const e = useStore((s) => s.employees.find((x) => x.id === blocked?.onId))
  if (!blocked) return null
  return (
    <div className="blocked-note">
      <Ban />
      <span>Blocked · waiting on {e?.name ?? 'someone'}{blocked.reason ? ` — ${blocked.reason}` : ''}</span>
    </div>
  )
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

// page enter animation — wrap each page's root
export function PageMotion({ children, className = 'page' }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

// One task as a list row. Clicking opens the drawer; the round tick completes it.
export function TaskRow({ task, showAssignee = false, showAssigner = true, canTick = true }) {
  const openTask = useStore((s) => s.openTask)
  const updateTask = useStore((s) => s.updateTask)
  const assigner = useStore((s) => s.employees.find((e) => e.id === task.assignedById))
  const assignee = useStore((s) => s.employees.find((e) => e.id === task.assigneeId))
  const done = task.status === 'done'
  return (
    <motion.div layout="position" className={`task-row ${done ? 'is-done' : ''}`} role="button" tabIndex={0}
      onClick={() => openTask(task.id)} onKeyDown={(e) => e.key === 'Enter' && openTask(task.id)} style={{ cursor: 'pointer' }}>
      <button
        className={`tick ${done ? 'on' : ''}`} disabled={!canTick} aria-label={done ? 'Mark as not done' : 'Mark as done'}
        onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: done ? 'todo' : 'done' }) }}
      ><Check /></button>
      <div style={{ minWidth: 0 }}>
        <div className="task-title truncate">{task.title}</div>
        <div className="task-meta">
          {task.clientId && <ClientTag clientId={task.clientId} />}
          {showAssigner && assigner && task.assignedById !== task.assigneeId && (<><span className="sep" /><span>from {assigner.name}</span></>)}
          {showAssignee && assignee && (<><span className="sep" /><span>{assignee.name}</span></>)}
          {task.blocked && (<><span className="sep" /><span style={{ color: 'var(--red)', fontWeight: 600 }}>Blocked</span></>)}
        </div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {!done && task.status !== 'todo' && <StatusBadge status={task.status} />}
        {!done && (task.priority === 'urgent' || task.priority === 'high') && <PriorityBadge priority={task.priority} />}
        <Due date={task.due} done={done} />
      </div>
    </motion.div>
  )
}
