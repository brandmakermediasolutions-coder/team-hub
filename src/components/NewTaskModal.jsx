import { useEffect, useMemo, useState } from 'react'
import { useStore, useCurrentUser } from '../store/useStore'
import { PRIORITIES } from '../store/seed'
import { assignableEmployees, visibleClients } from '../lib/permissions'
import { addDays } from '../lib/date'
import { Modal, Field } from './ui'

const blank = (userId, d = {}) => ({
  title: '', clientId: d.clientId ?? '', projectId: d.projectId ?? '', assigneeId: d.assigneeId ?? userId,
  due: d.due ?? addDays(2), priority: 'medium', doneWhen: '', description: '',
})

export default function NewTaskModal() {
  const user = useCurrentUser()
  const defaults = useStore((s) => s.newTask)
  const close = useStore((s) => s.closeNewTask)
  const createTask = useStore((s) => s.createTask)
  const showToast = useStore((s) => s.showToast)
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const [f, setF] = useState(() => blank(user.id))
  const [tried, setTried] = useState(false)

  useEffect(() => { if (defaults) { setF(blank(user.id, defaults)); setTried(false) } }, [defaults, user.id])

  const people = useMemo(() => assignableEmployees(user, employees), [user, employees])
  const myClients = useMemo(() => visibleClients(user, clients, projects, tasks, employees), [user, clients, projects, tasks, employees])
  const clientProjects = useMemo(() => projects.filter((p) => p.clientId === f.clientId), [projects, f.clientId])
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'clientId' ? { projectId: '' } : {}) }))

  const submit = (e) => {
    e?.preventDefault()
    setTried(true)
    if (!f.title.trim()) return
    createTask(f)
    const who = employees.find((x) => x.id === f.assigneeId)
    showToast(f.assigneeId === user.id ? 'Task added to your list' : `Task assigned to ${who?.name ?? 'teammate'}`)
    close()
  }

  return (
    <Modal open={!!defaults} onClose={close} title="New task" width={600}
      footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={submit}>Create task</button></>}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="What needs to be done?" className="span-2">
          <input className="input" autoFocus value={f.title} onChange={set('title')} placeholder="e.g. Design 4 festive story creatives" />
          {tried && !f.title.trim() && <span className="error-text">Give the task a title.</span>}
        </Field>
        <Field label="Assign to">
          <select className="select" value={f.assigneeId} onChange={set('assigneeId')}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === user.id ? ' (me)' : ''} — {p.title}</option>)}
          </select>
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={f.due} onChange={set('due')} />
        </Field>
        <Field label="Client">
          <select className="select" value={f.clientId} onChange={set('clientId')}>
            <option value="">Internal / no client</option>
            {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <select className="select" value={f.projectId} onChange={set('projectId')} disabled={!clientProjects.length}>
            <option value="">{clientProjects.length ? 'No project' : '—'}</option>
            {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="select" value={f.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Done when…" hint="One line that says what “finished” means.">
          <input className="input" value={f.doneWhen} onChange={set('doneWhen')} placeholder="e.g. 4 stories uploaded to Drive" />
        </Field>
        <Field label="Details (optional)" className="span-2">
          <textarea className="textarea" value={f.description} onChange={set('description')} placeholder="Brief, references, links…" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
