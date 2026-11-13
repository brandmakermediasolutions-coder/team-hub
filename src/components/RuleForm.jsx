import { useState } from 'react'
import { Check, Repeat } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SERVICES, WEEKDAYS } from '../store/seed'
import { ordinal, ruleSummary, shortService } from '../lib/repeat'
import { Modal, Field } from './ui'

// a labelled block that holds buttons (a <label> would pass clicks to the first button)
const Group = ({ label, hint, children }) => (
  <div className="field">{label && <span className="label">{label}</span>}{children}{hint && <span className="hint">{hint}</span>}</div>
)
import { PeopleOptions } from './NewTaskModal'

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
const blank = () => ({ title: '', scope: 'service', services: ['Social Media'], clientId: '', assign: 'service', personId: '', freq: 'monthly', day: 1, dueDay: 5, active: true })

// Add or edit a repeating rule (Admin → Repeating). rule = null for a new one.
export default function RuleForm({ open, rule, onClose }) {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const saveRule = useStore((s) => s.saveRule)
  const showToast = useStore((s) => s.showToast)
  const [f, setF] = useState(blank)
  const [tried, setTried] = useState(false)
  const [lastKey, setLastKey] = useState(null)
  const key = `${open}-${rule?.id ?? 'new'}`
  if (key !== lastKey) {
    setLastKey(key)
    setTried(false)
    setF(rule ? { ...blank(), ...rule, clientId: rule.clientId ?? '', personId: rule.personId ?? '', services: rule.services ?? [] } : blank())
  }

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const client = clients.find((c) => c.id === f.clientId)
  const scopeServices = f.scope === 'client' ? (client?.services ?? []) : SERVICES
  const errors = {
    title: !f.title.trim() && 'Write the task title.',
    services: f.scope === 'service' && !f.services.length && 'Tick at least one service.',
    clientId: f.scope === 'client' && !f.clientId && 'Choose the client.',
    personId: (f.assign === 'person' || f.scope === 'none') && !f.personId && 'Choose who does it.',
  }
  const clean = () => ({
    ...f, title: f.title.trim(),
    services: f.scope === 'none' ? [] : f.scope === 'client' ? f.services.filter((s) => scopeServices.includes(s)) : f.services,
    clientId: f.scope === 'client' ? f.clientId : null,
    assign: f.scope === 'none' ? 'person' : f.assign,
    personId: f.assign === 'person' || f.scope === 'none' ? f.personId : null,
    day: Number(f.day) || 1, dueDay: f.freq === 'weekly' ? Number(f.day) || 1 : Number(f.dueDay) || 1,
  })
  const save = () => {
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    saveRule(clean())
    showToast(rule ? 'Repeating task saved' : 'Repeating task added. This period’s tasks are made straight away.')
    onClose()
  }
  const err = (k) => tried && errors[k] && <span className="error-text">{errors[k]}</span>

  return (
    <Modal open={open} onClose={onClose} title={rule ? 'Edit repeating task' : 'New repeating task'} width={600}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <Field label="Task title" hint="{client} and {service} are filled in for each task, e.g. “Monthly report — {client}”.">
        <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus placeholder="e.g. Monthly {service} report — {client}" />
        {err('title')}
      </Field>

      <Group label="For which clients">
        <div className="seg seg-wrap">
          {[['service', 'Clients with a service'], ['client', 'One client'], ['none', 'No client']].map(([id, l]) => (
            <button type="button" key={id} className={f.scope === id ? 'on' : ''} onClick={() => set('scope', id)}>{l}</button>
          ))}
        </div>
      </Group>
      {f.scope === 'client' && (
        <Field label="Client">
          <select className="select" value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Choose…</option>
            {clients.filter((c) => c.active || c.id === f.clientId).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {err('clientId')}
        </Field>
      )}
      {f.scope !== 'none' && scopeServices.length > 0 && (
        <Group label={f.scope === 'service' ? 'Services' : 'One task per service (optional)'} hint={f.scope === 'service' ? 'Each client gets one task for every ticked service it has.' : 'Leave all unticked for a single task.'}>
          <div className="row row-wrap">
            {scopeServices.map((s) => (
              <label key={s} className={`check ${f.services.includes(s) ? 'on' : ''}`}>
                <input type="checkbox" checked={f.services.includes(s)} onChange={() => set('services', toggle(f.services, s))} />
                {f.services.includes(s) && <Check size={13} />}{shortService(s)}
              </label>
            ))}
          </div>
          {err('services')}
        </Group>
      )}

      <Group label="Who does it">
        {f.scope !== 'none' && (
          <div className="seg seg-wrap">
            {[['service', 'The service’s person'], ['owner', 'Account manager'], ['person', 'Someone specific']].map(([id, l]) => (
              <button type="button" key={id} className={f.assign === id ? 'on' : ''} onClick={() => set('assign', id)}>{l}</button>
            ))}
          </div>
        )}
        {(f.assign === 'person' || f.scope === 'none') && (
          <select className="select" value={f.personId} onChange={(e) => set('personId', e.target.value)}>
            <option value="">Choose…</option>
            <PeopleOptions employees={employees} />
          </select>
        )}
        {f.assign === 'service' && f.scope !== 'none' && <span className="hint">Social Media → account manager · PPC → the PPC person on the client, else the PPC head · SEO → the SEO person, else the SEO head.</span>}
        {err('personId')}
      </Group>

      <Group label="Repeats">
        <div className="seg">
          <button type="button" className={f.freq === 'monthly' ? 'on' : ''} onClick={() => set('freq', 'monthly')}>Monthly</button>
          <button type="button" className={f.freq === 'weekly' ? 'on' : ''} onClick={() => set('freq', 'weekly')}>Weekly</button>
        </div>
        {f.freq === 'monthly' ? (
          <div className="row row-wrap small soft">
            Appears on the
            <select className="select select-sm" value={f.day} onChange={(e) => set('day', Number(e.target.value))} aria-label="Day it appears">
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>)}
            </select>
            and is due on the
            <select className="select select-sm" value={f.dueDay} onChange={(e) => set('dueDay', Number(e.target.value))} aria-label="Day it is due">
              {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{ordinal(i + 1)}</option>)}
            </select>
            {Number(f.dueDay) < Number(f.day) && <span className="muted">(of the next month)</span>}
          </div>
        ) : (
          <div className="row row-wrap">
            {WEEKDAYS.map((d, i) => (
              <button type="button" key={d} className={`check ${Number(f.day) === i + 1 ? 'on' : ''}`} onClick={() => set('day', i + 1)}>{d.slice(0, 3)}</button>
            ))}
          </div>
        )}
      </Group>

      <div className="note-line"><Repeat size={14} />{ruleSummary(clean(), clients, employees)}</div>
    </Modal>
  )
}
