import { useState } from 'react'
import { ArrowUp, Plus, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { DEPARTMENTS, SERVICES } from '../store/seed'
import { shortService } from '../lib/repeat'
import { Modal, Field } from './ui'

const blankItem = () => ({ title: '', assign: 'owner', service: null, personId: null, days: 1 })
const whoValue = (it) => (it.assign === 'service' ? `service:${it.service ?? ''}` : it.assign === 'person' ? `person:${it.personId ?? ''}` : 'owner')
const fromWho = (v) => {
  const [kind, id] = v.split(':')
  return kind === 'service' ? { assign: 'service', service: id, personId: null }
    : kind === 'person' ? { assign: 'person', service: null, personId: id } : { assign: 'owner', service: null, personId: null }
}

// Add or edit a task template (Admin → Templates). template = null for a new one.
export default function TemplateForm({ open, template, onClose }) {
  const employees = useStore((s) => s.employees)
  const saveTemplate = useStore((s) => s.saveTemplate)
  const showToast = useStore((s) => s.showToast)
  const [f, setF] = useState({ name: '', items: [blankItem()] })
  const [tried, setTried] = useState(false)
  const [lastKey, setLastKey] = useState(null)
  const key = `${open}-${template?.id ?? 'new'}`
  if (key !== lastKey) {
    setLastKey(key)
    setTried(false)
    setF(template ? { name: template.name, items: (template.items ?? []).map((i) => ({ ...blankItem(), ...i })) } : { name: '', items: [blankItem()] })
  }

  const setItem = (i, patch) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))
  const move = (i) => setF((x) => {
    const items = [...x.items]
    ;[items[i - 1], items[i]] = [items[i], items[i - 1]]
    return { ...x, items }
  })
  const items = f.items.filter((it) => it.title.trim())
  const save = () => {
    setTried(true)
    if (!f.name.trim() || !items.length) return
    saveTemplate({ ...(template ?? {}), name: f.name.trim(), items: items.map((it) => ({ ...it, title: it.title.trim(), days: Math.max(0, Number(it.days) || 0) })) })
    showToast(template ? 'Template saved' : 'Template added')
    onClose()
  }
  const people = DEPARTMENTS.flatMap((d) => employees.filter((e) => e.active && e.department === d))

  return (
    <Modal open={open} onClose={onClose} title={template ? `Edit ${template.name}` : 'New template'} width={720}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <Field label="Template name">
        <input className="input" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} autoFocus placeholder="e.g. New website client" />
        {tried && !f.name.trim() && <span className="error-text">Give it a name.</span>}
      </Field>
      <div className="field">
        <span className="label">Tasks, in order</span>
        <div className="tpl-edit">
          {f.items.map((it, i) => (
            <div key={i} className="tpl-edit-row">
              <input className="input" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} placeholder="Task title" aria-label="Task title" />
              <select className="select" value={whoValue(it)} onChange={(e) => setItem(i, fromWho(e.target.value))} aria-label="Who does it">
                <option value="owner">Account manager</option>
                <optgroup label="The service’s person">
                  {SERVICES.filter((s) => s !== 'Website').map((s) => <option key={s} value={`service:${s}`}>{shortService(s)} person</option>)}
                </optgroup>
                <optgroup label="Someone specific">
                  {people.map((e) => <option key={e.id} value={`person:${e.id}`}>{e.name}</option>)}
                </optgroup>
              </select>
              <label className="tpl-days"><span className="muted small">in</span>
                <input className="input" type="number" min={0} max={90} value={it.days} onChange={(e) => setItem(i, { days: e.target.value })} aria-label="Due in days" />
                <span className="muted small">days</span>
              </label>
              <span className="row" style={{ gap: 0 }}>
                <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i)}><ArrowUp /></button>
                <button type="button" className="icon-btn" aria-label="Remove" onClick={() => setF((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}><X /></button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF((x) => ({ ...x, items: [...x.items, blankItem()] }))}><Plus />Add a task</button>
        {tried && !items.length && <span className="error-text">Add at least one task.</span>}
        <span className="hint">“In N days” counts from the day the template is used. 0 = same day.</span>
      </div>
    </Modal>
  )
}
