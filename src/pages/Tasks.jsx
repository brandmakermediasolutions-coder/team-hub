import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { List, Columns3, ListChecks, Plus } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { STATUSES, DEPARTMENTS } from '../store/seed'
import { canEditTask, isAdmin, isLead, teamIds } from '../lib/permissions'
import { daysUntil } from '../lib/date'
import { Avatar, ClientTag, Due, Empty, PageMotion, TaskRow, Urgent, STATUS_COLOR } from '../components/ui'

function Card({ task, overlay }) {
  const openTask = useStore((s) => s.openTask)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  return (
    <div ref={overlay ? undefined : setNodeRef} {...(overlay ? {} : { ...attributes, ...listeners })}
      className={`kcard ${isDragging ? 'dragging' : ''} ${overlay ? 'overlay' : ''}`} onClick={() => !overlay && openTask(task.id)}>
      <div className="kcard-title">{task.title}</div>
      {task.clientId && <div className="small muted"><ClientTag clientId={task.clientId} /></div>}
      <div className="kcard-foot">
        <span className="row" style={{ gap: 6 }}><Avatar id={task.assigneeId} size={22} />{task.urgent && task.status !== 'done' && <Urgent />}</span>
        <Due date={task.due} done={task.status === 'done'} />
      </div>
    </div>
  )
}

function Column({ status, items }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  return (
    <div ref={setNodeRef} className={`col ${isOver ? 'is-over' : ''}`}>
      <div className="col-head"><span className="col-dot" style={{ background: STATUS_COLOR[status.id] }} />{status.label}<span className="count">{items.length}</span></div>
      {items.length === 0 && <div className="col-empty">Drop tasks here</div>}
      {items.map((t) => <Card key={t.id} task={t} />)}
    </div>
  )
}

export default function Tasks() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const updateTask = useStore((s) => s.updateTask)
  const openNewTask = useStore((s) => s.openNewTask)
  const showToast = useStore((s) => s.showToast)
  const [params, setParams] = useSearchParams()
  const lead = isLead(user)

  const person = params.get('person') ?? (lead ? 'team' : 'me')
  const clientId = params.get('client') ?? ''
  const show = params.get('show') ?? 'open'
  const view = params.get('view') ?? 'list'
  const [q, setQ] = useState('')
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragId, setDragId] = useState(null)

  const filtered = useMemo(() => {
    const team = new Set(teamIds(user, employees))
    const t = q.trim().toLowerCase()
    return tasks.filter((x) => {
      if (person === 'me' && x.assigneeId !== user.id) return false
      if (person === 'gave' && (x.assignedById !== user.id || x.assigneeId === user.id)) return false
      if (person === 'team' && !team.has(x.assigneeId)) return false
      if (!['me', 'gave', 'team', 'all'].includes(person) && x.assigneeId !== person) return false
      if (clientId && x.clientId !== clientId) return false
      if (t && !x.title.toLowerCase().includes(t) && !(x.notes ?? '').toLowerCase().includes(t)) return false
      if (view === 'board') return true
      if (show === 'open') return x.status === 'todo' || x.status === 'doing'
      if (show === 'waiting') return x.status === 'waiting'
      if (show === 'overdue') return x.status !== 'done' && (daysUntil(x.due) ?? 1) < 0
      if (show === 'done') return x.status === 'done'
      return true
    }).sort((a, b) => (show === 'done' ? (b.completedAt ?? 0) - (a.completedAt ?? 0) : (a.due ?? '9').localeCompare(b.due ?? '9')))
  }, [tasks, employees, user, person, clientId, show, view, q])

  const onDragEnd = ({ active, over }) => {
    setDragId(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task || task.status === over.id) return
    if (!canEditTask(user, task, employees)) { showToast('You can only move your own tasks or tasks you gave.', 'error'); return }
    updateTask(task.id, { status: over.id })
  }

  const showAssignee = person !== 'me'

  return (
    <PageMotion className={`page ${view === 'board' ? 'page-wide' : ''}`}>
      <div className="page-head">
        <div><h1>Tasks</h1><p className="page-sub">Filter by person or client. Click a task to open it.</p></div>
        <button className="btn btn-primary" onClick={() => openNewTask({ clientId: clientId || undefined, assigneeId: !['me', 'gave', 'team', 'all'].includes(person) ? person : undefined })}><Plus />New task</button>
      </div>

      <div className="toolbar">
        <select className="select select-sm" value={person} onChange={(e) => setParam('person', e.target.value)} aria-label="Whose tasks">
          <option value="me">My tasks</option>
          <option value="gave">Tasks I gave others</option>
          {lead && <option value="team">{isAdmin(user) ? 'Everyone' : 'My team'}</option>}
          {!isAdmin(user) && <option value="all">Everyone</option>}
          {DEPARTMENTS.map((dep) => {
            const ppl = employees.filter((e) => e.active && e.department === dep && e.id !== user.id)
            return ppl.length ? <optgroup key={dep} label={dep}>{ppl.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup> : null
          })}
        </select>
        <select className="select select-sm" value={clientId} onChange={(e) => setParam('client', e.target.value)} aria-label="Client">
          <option value="">All clients</option>
          {clients.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" style={{ width: 200, height: 32 }} placeholder="Filter by words…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grow" />
        {view === 'list' && (
          <div className="seg">
            {[['open', 'To do'], ['waiting', 'Waiting on client'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']].map(([id, l]) => (
              <button key={id} className={show === id ? 'on' : ''} onClick={() => setParam('show', id === 'open' ? '' : id)}>{l}</button>
            ))}
          </div>
        )}
        <div className="seg">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setParam('view', '')}><List />List</button>
          <button className={view === 'board' ? 'on' : ''} onClick={() => setParam('view', 'board')}><Columns3 />Board</button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="card" style={{ padding: 8 }}>
          {filtered.length === 0
            ? <Empty icon={ListChecks} title="No tasks here" text={show === 'overdue' ? 'Nothing is overdue. Nice.' : 'Try another filter.'} />
            : filtered.map((t) => <TaskRow key={t.id} task={t} showAssignee={showAssignee} />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e) => setDragId(e.active.id)} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="board">
            {STATUSES.map((s) => (
              <Column key={s.id} status={s} items={filtered.filter((t) => t.status === s.id && (s.id !== 'done' || (t.completedAt ?? 0) > Date.now() - 14 * 86400000))} />
            ))}
          </div>
          <DragOverlay>{dragId ? <Card task={tasks.find((t) => t.id === dragId)} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
    </PageMotion>
  )
}
