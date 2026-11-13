import { useEffect, useMemo, useState } from 'react'
import { Flame, Mail } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { DEPARTMENTS } from '../store/seed'
import { isCloud } from '../lib/backend'
import { addDays, todayIso } from '../lib/date'
import { awayLabel, isAway } from '../lib/repeat'
import { Modal, Field, LeaveWarning } from './ui'

const blank = (userId, d = {}) => ({
  title: '', clientId: d.clientId ?? '', assigneeId: d.assigneeId ?? userId, due: d.due ?? addDays(1), urgent: false, notes: '',
})

// the coming Monday
const nextMonday = () => addDays(((8 - new Date().getDay()) % 7) || 7)

export function PeopleOptions({ employees, meId }) {
  return DEPARTMENTS.map((dep) => {
    const people = employees.filter((e) => e.active && e.department === dep)
    if (!people.length) return null
    return (
      <optgroup key={dep} label={dep}>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === meId ? ' (me)' : ''}{isAway(p) ? ` · ${awayLabel(p).replace(/^Away/, 'away')}` : ''}</option>)}
      </optgroup>
    )
  })
}

export default function NewTaskModal() {
  const user = useCurrentUser()
  const defaults = useStore((s) => s.newTask)
  const close = useStore((s) => s.closeNewTask)
  const createTask = useStore((s) => s.createTask)
  const showToast = useStore((s) => s.showToast)
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const [f, setF] = useState(() => blank(user.id))
  const [tried, setTried] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => { if (defaults) { setF(blank(user.id, defaults)); setTried(false); setShowNotes(false) } }, [defaults, user.id])

  const activeClients = useMemo(() => {
    const mine = clients.filter((c) => c.active && c.memberIds?.includes(user.id))
    const rest = clients.filter((c) => c.active && !c.memberIds?.includes(user.id))
    return { mine, rest }
  }, [clients, user.id])

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const who = employees.find((x) => x.id === f.assigneeId)
  const forSomeoneElse = f.assigneeId !== user.id

  const submit = (e) => {
    e?.preventDefault()
    setTried(true)
    if (!f.title.trim()) return
    createTask(f)
    showToast(!forSomeoneElse ? 'Task added to your list'
      : isCloud ? `Task given to ${who?.name}. They'll get an email.` : `Task given to ${who?.name}. (Demo mode: no email is sent.)`)
    close()
  }

  const dueChips = [['Today', todayIso()], ['Tomorrow', addDays(1)], ['Next Monday', nextMonday()]]

  return (
    <Modal open={!!defaults} onClose={close} title="New task" width={540}
      footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={submit}>{forSomeoneElse ? `Give to ${who?.name.split(' ')[0]}` : 'Add task'}</button></>}>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <Field label="What needs to be done?">
          <input className="input input-lg" autoFocus value={f.title} onChange={set('title')} placeholder="e.g. 4 Black Friday story creatives" />
          {tried && !f.title.trim() && <span className="error-text">Write what the task is.</span>}
        </Field>
        <div className="form-grid">
          <Field label="Who does it?">
            <select className="select" value={f.assigneeId} onChange={set('assigneeId')}>
              <PeopleOptions employees={employees} meId={user.id} />
            </select>
          </Field>
          <Field label="Client">
            <select className="select" value={f.clientId} onChange={set('clientId')}>
              <option value="">Internal / no client</option>
              {activeClients.mine.length > 0 && <optgroup label="My clients">{activeClients.mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
              <optgroup label={activeClients.mine.length ? 'Other clients' : 'Clients'}>{activeClients.rest.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            </select>
          </Field>
        </div>
        <Field label="Due">
          <div className="row row-wrap">
            {dueChips.map(([l, d]) => (
              <button type="button" key={l} className={`check ${f.due === d ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, due: d }))}>{l}</button>
            ))}
            <input className="input" type="date" style={{ width: 160, height: 32 }} value={f.due ?? ''} onChange={set('due')} aria-label="Pick a date" />
          </div>
        </Field>
        <LeaveWarning personId={f.assigneeId} due={f.due} />
        <div className="row row-wrap between">
          <label className={`check ${f.urgent ? 'on urgent' : ''}`}>
            <input type="checkbox" checked={f.urgent} onChange={set('urgent')} /><Flame size={13} />Urgent
          </label>
          {!showNotes && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNotes(true)}>+ Add notes or a link</button>}
        </div>
        {showNotes && (
          <Field label="Notes">
            <textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="Brief, references, Drive link…" />
          </Field>
        )}
        {forSomeoneElse && (
          <div className="note-line"><Mail size={14} />{who?.name} will be notified{isCloud ? ' by email and in Team Hub' : ' in Team Hub'}.</div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
