import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, MessageSquare, ChartColumn } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { STATUSES, PRIORITIES } from '../store/seed'
import { canEditTask, scopeIds, visibleTasks } from '../lib/permissions'
import { daysUntil } from '../lib/date'
import { Avatar, BlockedNote, ClientTag, Due, PageMotion, PriorityBadge, STATUS_COLOR } from '../components/ui'

function CardInner({ task, commentCount }) {
  return (
    <>
      <div className="row between small muted">
        {task.clientId ? <ClientTag clientId={task.clientId} /> : <span>Internal</span>}
        {(task.priority === 'urgent' || task.priority === 'high') && <PriorityBadge priority={task.priority} />}
      </div>
      <div className="kcard-title">{task.title}</div>
      {task.blocked && <BlockedNote blocked={task.blocked} />}
      <div className="kcard-foot">
        <Due date={task.due} done={task.status === 'done'} />
        <span className="row" style={{ gap: 10 }}>
          {commentCount > 0 && <span className="row muted small" style={{ gap: 4 }}><MessageSquare size={13} />{commentCount}</span>}
          <Avatar id={task.assigneeId} size={24} />
        </span>
      </div>
    </>
  )
}

function Card({ task, commentCount, draggable }) {
  const openTask = useStore((s) => s.openTask)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable })
  return (
    <motion.div layout="position" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
      <div ref={setNodeRef} {...attributes} {...listeners} className={`kcard ${isDragging ? 'dragging' : ''}`}
        style={draggable ? undefined : { cursor: 'pointer' }}
        onClick={() => openTask(task.id)} onKeyDown={(e) => e.key === 'Enter' && openTask(task.id)}>
        <CardInner task={task} commentCount={commentCount} />
      </div>
    </motion.div>
  )
}

function Column({ status, tasks, counts, canDrag, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  return (
    <div ref={setNodeRef} className={`col ${isOver ? 'is-over' : ''}`}>
      <div className="col-head">
        <span className="col-dot" style={{ background: STATUS_COLOR[status.id] }} />{status.label}
        <span className="count">{tasks.length}</span>
        {status.id === 'todo' && <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onAdd} aria-label="Add task"><Plus /></button>}
      </div>
      <AnimatePresence initial={false}>
        {tasks.map((t) => <Card key={t.id} task={t} commentCount={counts[t.id] ?? 0} draggable={canDrag(t)} />)}
      </AnimatePresence>
      {tasks.length === 0 && <div className="col-empty">Drop a task here</div>}
    </div>
  )
}

function Workload({ people, tasks }) {
  const rows = people.map((p) => {
    const open = tasks.filter((t) => t.assigneeId === p.id && t.status !== 'done')
    return {
      p, total: open.length,
      todo: open.filter((t) => t.status === 'todo').length,
      progress: open.filter((t) => t.status === 'progress').length,
      review: open.filter((t) => t.status === 'review').length,
      overdue: open.filter((t) => (daysUntil(t.due) ?? 1) < 0).length,
    }
  }).sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <motion.div className="card card-pad" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
      <div className="row between">
        <h2>Workload</h2>
        <div className="row small muted" style={{ gap: 14 }}>
          {[['To do', 'var(--grey)'], ['In progress', 'var(--blue)'], ['In review', 'var(--amber)']].map(([l, c]) => (
            <span key={l} className="row" style={{ gap: 6 }}><span className="col-dot" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </div>
      <div className="mt-8">
        {rows.map(({ p, total, todo, progress, review, overdue }) => (
          <div className="load-row" key={p.id}>
            <span className="row"><Avatar id={p.id} size={26} /><span className="truncate strong">{p.name}</span></span>
            <div className="load-bar">
              <span style={{ width: `${(todo / max) * 100}%`, background: 'var(--grey)' }} />
              <span style={{ width: `${(progress / max) * 100}%`, background: 'var(--blue)' }} />
              <span style={{ width: `${(review / max) * 100}%`, background: 'var(--amber)' }} />
            </div>
            <span className="small mono" style={{ textAlign: 'right' }}>
              {total} open{overdue > 0 && <span style={{ color: 'var(--red)' }}> · {overdue} late</span>}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function Board() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const comments = useStore((s) => s.comments)
  const updateTask = useStore((s) => s.updateTask)
  const openNewTask = useStore((s) => s.openNewTask)
  const isLead = user.role !== 'employee'

  const [person, setPerson] = useState(isLead ? 'all' : user.id)
  const [client, setClient] = useState('all')
  const [prio, setPrio] = useState('all')
  const [showLoad, setShowLoad] = useState(isLead)
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const scope = useMemo(() => visibleTasks(user, tasks, employees), [user, tasks, employees])
  const people = useMemo(() => { const ids = new Set(scopeIds(user, employees)); return employees.filter((e) => e.active && ids.has(e.id)) }, [user, employees])
  const usedClients = useMemo(() => { const ids = new Set(scope.map((t) => t.clientId)); return clients.filter((c) => ids.has(c.id)) }, [scope, clients])
  const counts = useMemo(() => comments.reduce((m, c) => { m[c.taskId] = (m[c.taskId] ?? 0) + 1; return m }, {}), [comments])

  const shown = useMemo(() => scope
    .filter((t) => person === 'all' || t.assigneeId === person)
    .filter((t) => client === 'all' || t.clientId === client)
    .filter((t) => prio === 'all' || t.priority === prio)
    .filter((t) => t.status !== 'done' || (t.completedAt ?? 0) > Date.now() - 7 * 86400000)
    .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')), [scope, person, client, prio])

  const active = activeId ? tasks.find((t) => t.id === activeId) : null
  const onDragEnd = ({ active: a, over }) => {
    setActiveId(null)
    if (!over) return
    const t = tasks.find((x) => x.id === a.id)
    if (t && t.status !== over.id) updateTask(t.id, { status: over.id })
  }

  return (
    <PageMotion className="page page-wide">
      <div className="page-head">
        <div>
          <h1>{isLead ? 'Team Board' : 'My Board'}</h1>
          <p className="page-sub">Drag a card to change its status. Click a card for details. Done shows the last 7 days.</p>
        </div>
        <div className="toolbar">
          {isLead && (
            <select className="select select-sm" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Filter by person">
              <option value="all">Everyone</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === user.id ? ' (me)' : ''}</option>)}
            </select>
          )}
          <select className="select select-sm" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Filter by client">
            <option value="all">All clients</option>
            {usedClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select select-sm" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Filter by priority">
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {isLead && <button className={`btn btn-sm ${showLoad ? '' : 'btn-ghost'}`} onClick={() => setShowLoad((v) => !v)}><ChartColumn />Workload</button>}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isLead && showLoad && <Workload key="load" people={people} tasks={scope} />}
      </AnimatePresence>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="board">
          {STATUSES.map((s) => (
            <Column key={s.id} status={s} tasks={shown.filter((t) => t.status === s.id)} counts={counts}
              canDrag={(t) => canEditTask(user, t, employees)}
              onAdd={() => openNewTask(person !== 'all' ? { assigneeId: person } : {})} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {active && <div className="kcard overlay"><CardInner task={active} commentCount={counts[active.id] ?? 0} /></div>}
        </DragOverlay>
      </DndContext>
    </PageMotion>
  )
}
