import { useState } from 'react'
import { ArrowLeft, LayoutList, X } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { addDays } from '../lib/date'
import { resolvePerson } from '../lib/repeat'
import { AwayTag, Due, Empty, Modal } from './ui'
import { PeopleOptions } from './NewTaskModal'

// Client page: pick a template, check the tasks it will make (people and dates filled in), then create them.
export default function TemplatePicker({ open, client, onClose }) {
  const user = useCurrentUser()
  const templates = useStore((s) => s.templates)
  const employees = useStore((s) => s.employees)
  const createTask = useStore((s) => s.createTask)
  const showToast = useStore((s) => s.showToast)
  const [lines, setLines] = useState(null) // null = choosing a template
  const [picked, setPicked] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) { setWasOpen(open); setLines(null); setPicked(null) }

  const choose = (tpl) => {
    setPicked(tpl)
    setLines((tpl.items ?? []).map((it, i) => ({
      key: i, title: it.title, due: addDays(Math.max(0, Number(it.days) || 0)),
      assigneeId: resolvePerson(it, client, employees) ?? user.id,
    })))
  }
  const edit = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const create = () => {
    lines.forEach((l) => createTask({ title: l.title, clientId: client.id, assigneeId: l.assigneeId, due: l.due }))
    showToast(`${lines.length} task${lines.length === 1 ? '' : 's'} created for ${client.name}`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={picked ? picked.name : 'Use a template'} width={640}
      footer={lines ? <>
        <button className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => { setLines(null); setPicked(null) }}><ArrowLeft />Templates</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!lines.length} onClick={create}>Create {lines.length} task{lines.length === 1 ? '' : 's'}</button>
      </> : null}>
      {!lines && (
        templates.length === 0
          ? <Empty icon={LayoutList} title="No templates yet" text="The admin can add them in Admin → Templates." />
          : <div className="stack" style={{ gap: 8 }}>
              {[...templates].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                <button key={t.id} className="tpl-pick" onClick={() => choose(t)}>
                  <LayoutList size={18} className="muted" />
                  <div className="grow"><div className="strong">{t.name}</div><div className="tiny muted truncate">{(t.items ?? []).map((i) => i.title).join(' · ')}</div></div>
                  <span className="badge">{(t.items ?? []).length} tasks</span>
                </button>
              ))}
            </div>
      )}
      {lines && (
        <>
          <p className="small muted">For {client.name}. Change who does it, or remove anything you don't need.</p>
          <div className="tpl-lines">
            {lines.length === 0 && <div className="muted small">All lines removed.</div>}
            {lines.map((l) => (
              <div key={l.key} className="tpl-line">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong">{l.title}</div>
                  <div className="row row-wrap mt-4" style={{ gap: 8 }}>
                    <select className="select select-sm" value={l.assigneeId} onChange={(e) => edit(l.key, { assigneeId: e.target.value })} aria-label="Who does it">
                      <PeopleOptions employees={employees} meId={user.id} />
                    </select>
                    <AwayTag id={l.assigneeId} />
                    <Due date={l.due} />
                  </div>
                </div>
                <button className="icon-btn" aria-label="Remove this task" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><X /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
