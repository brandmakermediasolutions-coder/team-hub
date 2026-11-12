import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SERVICES, DEPARTMENTS } from '../store/seed'
import { Modal, Field, Avatar } from './ui'
import { PeopleOptions } from './NewTaskModal'

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

// Add or edit a client. client = null for a new one.
export default function ClientForm({ open, client, onClose }) {
  const employees = useStore((s) => s.employees)
  const createClient = useStore((s) => s.createClient)
  const updateClient = useStore((s) => s.updateClient)
  const showToast = useStore((s) => s.showToast)
  const [f, setF] = useState(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    setTried(false)
    setF(client
      ? { name: client.name, services: client.services ?? [], ownerId: client.ownerId ?? '', memberIds: client.memberIds ?? [], deliverables: client.deliverables ?? '', ads: client.ads ?? '', brief: client.brief ?? '', active: client.active }
      : { name: '', services: ['Social Media'], ownerId: '', memberIds: [], deliverables: '', ads: '', brief: '', active: true })
  }, [open, client])

  if (!f) return null
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = () => {
    setTried(true)
    if (!f.name.trim() || !f.ownerId) return
    if (client) updateClient(client.id, { ...f, name: f.name.trim() })
    else createClient(f)
    showToast(client ? 'Client saved' : `${f.name.trim()} added`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? `Edit ${client.name}` : 'Add client'} width={620}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Client name">
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
          {tried && !f.name.trim() && <span className="error-text">Add a name.</span>}
        </Field>
        <Field label="Account manager">
          <select className="select" value={f.ownerId} onChange={set('ownerId')}>
            <option value="">Choose…</option>
            <PeopleOptions employees={employees} />
          </select>
          {tried && !f.ownerId && <span className="error-text">Choose who manages this client.</span>}
        </Field>
        <Field label="Services" className="span-2">
          <div className="row row-wrap">
            {SERVICES.map((s) => (
              <label key={s} className={`check ${f.services.includes(s) ? 'on' : ''}`}>
                <input type="checkbox" checked={f.services.includes(s)} onChange={() => setF((x) => ({ ...x, services: toggle(x.services, s) }))} />
                {f.services.includes(s) && <Check size={13} />}{s}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Who else works on it" className="span-2" hint="They will see this client on their My Day page.">
          <div className="people-pick">
            {DEPARTMENTS.map((dep) => {
              const ppl = employees.filter((e) => e.active && e.department === dep && e.id !== f.ownerId)
              if (!ppl.length) return null
              return (
                <div key={dep} className="row row-wrap" style={{ gap: 6 }}>
                  <span className="tiny muted" style={{ width: 130 }}>{dep}</span>
                  {ppl.map((e) => (
                    <label key={e.id} className={`check ${f.memberIds.includes(e.id) ? 'on' : ''}`}>
                      <input type="checkbox" checked={f.memberIds.includes(e.id)} onChange={() => setF((x) => ({ ...x, memberIds: toggle(x.memberIds, e.id) }))} />
                      <Avatar id={e.id} size={16} />{e.name.split(' ')[0]}
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </Field>
        <Field label="Monthly deliverables" hint="e.g. 10 posts (mix) + 10 stories">
          <input className="input" value={f.deliverables} onChange={set('deliverables')} />
        </Field>
        <Field label="Ads" hint="Platform · campaign type, e.g. FB · Lead gen">
          <input className="input" value={f.ads} onChange={set('ads')} />
        </Field>
        <Field label="Notes for the team" className="span-2">
          <textarea className="textarea" value={f.brief} onChange={set('brief')} placeholder="Tone, approvals, who to contact, anything the team should know" />
        </Field>
        {client && (
          <label className={`check ${!f.active ? 'on' : ''}`} style={{ justifySelf: 'start' }}>
            <input type="checkbox" checked={!f.active} onChange={(e) => setF((x) => ({ ...x, active: !e.target.checked }))} />Paused / no longer active
          </label>
        )}
      </div>
    </Modal>
  )
}
