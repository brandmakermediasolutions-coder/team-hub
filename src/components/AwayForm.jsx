import { useState } from 'react'
import { useStore, useCurrentUser } from '../store/useStore'
import { addDays, todayIso } from '../lib/date'
import { hasLeave } from '../lib/repeat'
import { Modal, Field } from './ui'

// Mark someone as on leave (from / to / optional note). personId = null closes it.
export default function AwayForm({ personId, onClose }) {
  const me = useCurrentUser()
  const person = useStore((s) => s.employees.find((e) => e.id === personId) ?? null)
  const setAway = useStore((s) => s.setAway)
  const showToast = useStore((s) => s.showToast)
  const [f, setF] = useState(null)
  const [lastKey, setLastKey] = useState(null)
  const key = person?.id ?? null
  if (key !== lastKey) {
    setLastKey(key)
    setF(person ? { awayFrom: person.awayFrom ?? todayIso(), awayTo: person.awayTo ?? addDays(1), awayNote: person.awayNote ?? '' } : null)
  }

  const self = person?.id === me.id
  const first = person?.name.split(' ')[0]
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = () => {
    if (!f.awayFrom || !f.awayTo) return
    setAway(person.id, f)
    showToast(self ? 'Leave saved. The team will see it.' : `${first}'s leave saved`)
    onClose()
  }
  const clear = () => {
    setAway(person.id, {})
    showToast(self ? 'Welcome back' : `${first} is back`)
    onClose()
  }

  return (
    <Modal open={!!person && !!f} onClose={onClose} title={self ? 'I’m on leave' : `${first} is on leave`} width={460}
      footer={<>
        {person && hasLeave(person) && <button className="btn btn-ghost btn-danger" style={{ marginRight: 'auto' }} onClick={clear}>{self ? 'I’m back' : 'Clear leave'}</button>}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={!f?.awayFrom || !f?.awayTo}>Save</button>
      </>}>
      {f && (
        <>
          <div className="form-grid">
            <Field label="From"><input className="input" type="date" value={f.awayFrom} onChange={set('awayFrom')} /></Field>
            <Field label="To (last day off)"><input className="input" type="date" value={f.awayTo} min={f.awayFrom} onChange={set('awayTo')} /></Field>
          </div>
          <Field label="Note (optional)"><input className="input" value={f.awayNote} onChange={set('awayNote')} placeholder="e.g. Diwali break · reachable on phone" /></Field>
          <p className="small muted">People see “Away” next to {self ? 'your' : 'their'} name, and get a gentle warning when giving {self ? 'you' : 'them'} work due in these days.</p>
        </>
      )}
    </Modal>
  )
}
