import { useMemo, useState } from 'react'
import { Users, Building2, Settings, UserPlus, Plus, Pencil, Database, Mail, RotateCcw, CircleCheck, CircleAlert } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { DEPARTMENTS, emailFor } from '../store/seed'
import { ROLE_LABEL } from '../lib/permissions'
import { isCloud } from '../lib/backend'
import { Avatar, AvatarStack, Field, Modal, PageMotion } from '../components/ui'
import { PeopleOptions } from '../components/NewTaskModal'
import ClientForm from '../components/ClientForm'

const RANK = { admin: 0, head: 1, member: 2 }
const ROLE_TONE = { admin: 'tone-accent', head: 'tone-violet', member: 'tone-grey' }

function PersonForm({ person, open, onClose }) {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const createEmployee = useStore((s) => s.createEmployee)
  const updateEmployee = useStore((s) => s.updateEmployee)
  const showToast = useStore((s) => s.showToast)
  const initial = () => (person
    ? { name: person.name, title: person.title, department: person.department, role: person.role, headId: person.headId ?? '', email: person.email ?? '', phone: person.phone ?? '', active: person.active }
    : { name: '', title: '', department: 'Social Media', role: 'member', headId: '', email: '', phone: '', active: true })
  const [f, setF] = useState(initial)
  const [emailTouched, setEmailTouched] = useState(!!person)
  const [tried, setTried] = useState(false)
  const [lastKey, setLastKey] = useState(null)
  const key = `${open}-${person?.id ?? 'new'}`
  if (key !== lastKey) { setLastKey(key); setF(initial()); setEmailTouched(!!person); setTried(false) }

  const self = person?.id === me.id
  const set = (k) => (e) => setF((x) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    const next = { ...x, [k]: v }
    if (k === 'name' && !emailTouched) next.email = emailFor(v)
    return next
  })
  const emailTaken = f.email && employees.some((e) => e.id !== person?.id && (e.email ?? '').toLowerCase() === f.email.trim().toLowerCase())

  const save = () => {
    setTried(true)
    if (!f.name.trim() || emailTaken) return
    const data = { ...f, name: f.name.trim(), title: f.title.trim(), headId: f.headId || null }
    if (person) { updateEmployee(person.id, data); showToast(`${data.name} saved`) }
    else { createEmployee(data); showToast(`${data.name} added. They can now create a password on the sign-in page.`) }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={person ? `Edit ${person.name}` : 'Add person'} width={560}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Full name">
          <input className="input" value={f.name} onChange={set('name')} autoFocus />
          {tried && !f.name.trim() && <span className="error-text">Add a name.</span>}
        </Field>
        <Field label="Designation"><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. Social Media Manager" /></Field>
        <Field label="Work email" hint="Used to sign in and for task emails.">
          <input className="input" type="email" value={f.email} onChange={(e) => { setEmailTouched(true); set('email')(e) }} />
          {emailTaken && <span className="error-text">Someone else already uses this email.</span>}
        </Field>
        <Field label="Phone (optional)"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Department">
          <select className="select" value={f.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
        </Field>
        <Field label="Reports to">
          <select className="select" value={f.headId} onChange={set('headId')}>
            <option value="">No one</option>
            <PeopleOptions employees={employees.filter((e) => e.id !== person?.id)} />
          </select>
        </Field>
        <Field label="Access" hint={f.role === 'admin' ? 'Sees and edits everything, including this page.' : f.role === 'head' ? 'Sees the Team page for the people who report to them.' : 'Sees their own work and all clients.'}>
          <select className="select" value={f.role} onChange={set('role')} disabled={self}>
            <option value="member">Member</option><option value="head">Head</option><option value="admin">Admin</option>
          </select>
        </Field>
        {person && !self && (
          <Field label="Status">
            <label className={`check ${!f.active ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }}>
              <input type="checkbox" checked={!f.active} onChange={(e) => setF((x) => ({ ...x, active: !e.target.checked }))} />Left the team (can't sign in)
            </label>
          </Field>
        )}
      </div>
    </Modal>
  )
}

export default function Admin() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const resetDemo = useStore((s) => s.resetDemo)
  const [tab, setTab] = useState('people')
  const [personModal, setPersonModal] = useState(null) // { person } | null
  const [clientModal, setClientModal] = useState(null)
  const [showLeft, setShowLeft] = useState(false)

  const byId = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])
  const openBy = useMemo(() => {
    const m = {}
    tasks.forEach((t) => { if (t.status !== 'done') m[t.assigneeId] = (m[t.assigneeId] || 0) + 1 })
    return m
  }, [tasks])
  const people = employees.filter((e) => (showLeft ? !e.active : e.active))
    .sort((a, b) => DEPARTMENTS.indexOf(a.department) - DEPARTMENTS.indexOf(b.department) || RANK[a.role] - RANK[b.role] || a.name.localeCompare(b.name))

  return (
    <PageMotion>
      <div className="page-head"><div><h1>Admin</h1><p className="page-sub">People, clients and setup. Changes apply for everyone straight away.</p></div></div>

      <div className="tabs">
        <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}><Users />People</button>
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}><Building2 />Clients</button>
        <button className={`tab ${tab === 'setup' ? 'active' : ''}`} onClick={() => setTab('setup')}><Settings />Setup</button>
      </div>

      {tab === 'people' && (
        <div className="stack">
          <div className="row between">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLeft((x) => !x)}>{showLeft ? 'Show current team' : 'Show people who left'}</button>
            <button className="btn btn-primary btn-sm" onClick={() => setPersonModal({ person: null })}><UserPlus />Add person</button>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Person</th><th>Email</th><th>Department</th><th>Reports to</th><th>Access</th><th>Open tasks</th><th /></tr></thead>
              <tbody>
                {people.map((e) => (
                  <tr key={e.id} className="click-row" onClick={() => setPersonModal({ person: e })}>
                    <td><div className="row" style={{ gap: 10 }}><Avatar id={e.id} size={30} /><div><b>{e.name}</b><div className="tiny muted">{e.title}</div></div></div></td>
                    <td className="small">{e.email || <span className="muted">Not set</span>}</td>
                    <td>{e.department}</td>
                    <td>{byId[e.headId]?.name ?? <span className="muted">—</span>}</td>
                    <td><span className={`badge ${ROLE_TONE[e.role]}`}>{ROLE_LABEL[e.role]}</span></td>
                    <td>{openBy[e.id] || 0}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm"><Pencil />Edit</button></td>
                  </tr>
                ))}
                {people.length === 0 && <tr><td colSpan={7} className="muted">Nobody here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <div className="stack">
          <div className="row between">
            <div className="small muted">{clients.filter((c) => c.active).length} active · {clients.filter((c) => !c.active).length} paused</div>
            <button className="btn btn-primary btn-sm" onClick={() => setClientModal({ client: null })}><Plus />Add client</button>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Client</th><th>Services</th><th>Account manager</th><th>Team</th><th>Status</th><th /></tr></thead>
              <tbody>
                {[...clients].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)).map((c) => (
                  <tr key={c.id} className="click-row" onClick={() => setClientModal({ client: c })}>
                    <td><div className="row" style={{ gap: 8 }}><span className="client-dot" style={{ background: c.color }} /><b>{c.name}</b></div></td>
                    <td><div className="row row-wrap" style={{ gap: 4 }}>{c.services.map((s) => <span key={s} className="chip">{s}</span>)}</div></td>
                    <td>{byId[c.ownerId]?.name ?? <span className="muted">—</span>}</td>
                    <td><AvatarStack ids={c.memberIds ?? []} max={4} /></td>
                    <td><span className={`badge ${c.active ? 'tone-green' : 'tone-grey'}`}>{c.active ? 'Active' : 'Paused'}</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm"><Pencil />Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'setup' && (
        <div className="grid grid-2">
          <div className="card card-pad stack">
            <h2 className="row"><Database size={16} />Shared database</h2>
            {isCloud
              ? <div className="row ok-text"><CircleCheck size={16} />Connected. Everyone sees the same data, live.</div>
              : <div className="row" style={{ color: 'var(--amber)' }}><CircleAlert size={16} />Demo mode. Data is saved in this browser only.</div>}
            <p className="small soft">To connect, follow SETUP.md in the GitHub repo (about 15 minutes, done once).</p>
            {!isCloud && <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => window.confirm('Reset all demo data to the starting data?') && resetDemo()}><RotateCcw />Reset demo data</button>}
          </div>
          <div className="card card-pad stack">
            <h2 className="row"><Mail size={16} />Task emails</h2>
            <p className="small soft">When someone gives a task to a teammate (new or reassigned), the teammate gets an email with the task, client, due date and a link that opens it.</p>
            <p className="small soft">Emails go to each person's work email in People. Sending is set up in Supabase (see SETUP.md, step 5).</p>
          </div>
          <div className="card card-pad stack">
            <h2 className="row"><Users size={16} />How sign-in works</h2>
            <p className="small soft">1. Add the person here with their work email.<br />2. They open Team Hub, choose “First time? Create password”, and confirm from their inbox.<br />3. If someone leaves, edit them and tick “Left the team”. They can no longer sign in, and their history stays.</p>
          </div>
        </div>
      )}

      <PersonForm open={!!personModal} person={personModal?.person ?? null} onClose={() => setPersonModal(null)} />
      <ClientForm open={!!clientModal} client={clientModal?.client ?? null} onClose={() => setClientModal(null)} />
    </PageMotion>
  )
}
