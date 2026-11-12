import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Building2 } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { SERVICES } from '../store/seed'
import { visibleClients, visibleTasks, canManageClients, assignableEmployees } from '../lib/permissions'
import { daysUntil } from '../lib/date'
import { Avatar, AvatarStack, Modal, Field, Empty, PageMotion } from '../components/ui'

const EMPTY = { name: '', industry: '', services: [], ownerId: '', brief: '' }

export default function Clients() {
  const user = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const createClient = useStore((s) => s.createClient)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const list = useMemo(() => visibleClients(user, clients, projects, tasks, employees), [user, clients, projects, tasks, employees])
  const myTasks = useMemo(() => visibleTasks(user, tasks, employees), [user, tasks, employees])
  const owners = useMemo(() => assignableEmployees(user, employees), [user, employees])

  const stats = useMemo(() => {
    const out = {}
    list.forEach((c) => {
      const ts = myTasks.filter((t) => t.clientId === c.id)
      const done = ts.filter((t) => t.status === 'done').length
      const openTasks = ts.length - done
      const overdue = ts.filter((t) => t.status !== 'done' && t.due && daysUntil(t.due) < 0).length
      const people = [...new Set(projects.filter((p) => p.clientId === c.id).flatMap((p) => p.memberIds))]
      out[c.id] = { total: ts.length, done, open: openTasks, overdue, people }
    })
    return out
  }, [list, myTasks, projects])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggleService = (s) => set({ services: form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s] })
  const close = () => { setOpen(false); setForm(EMPTY) }
  const valid = form.name.trim() && form.ownerId
  const submit = (e) => {
    e?.preventDefault()
    if (!valid) return
    createClient(form)
    close()
  }

  return (
    <PageMotion>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <div className="page-sub">{list.length} {list.length === 1 ? 'client' : 'clients'}</div>
        </div>
        {canManageClients(user) && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New client</button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty icon={Building2} title="No clients yet" text="Clients you work with will show up here." /></div>
      ) : (
        <div className="grid grid-auto">
          {list.map((c) => {
            const st = stats[c.id]
            const owner = employees.find((e) => e.id === c.ownerId)
            const pct = st.total ? Math.round((st.done / st.total) * 100) : 0
            return (
              <Link key={c.id} to={`/clients/${c.id}`} className="card card-hover card-pad" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
                <div className="stack" style={{ gap: 14 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, background: c.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                      <div className="small muted truncate">{c.industry || 'No industry'}</div>
                    </div>
                  </div>

                  <div className="row row-wrap" style={{ gap: 6 }}>
                    {c.services.map((s) => <span key={s} className="chip">{s}</span>)}
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <Avatar id={c.ownerId} size={24} />
                    <span className="small truncate">{owner?.name ?? 'Unassigned'}</span>
                    <span className="small muted">· owner</span>
                  </div>

                  <div>
                    <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span><b>{st.open}</b> <span className="muted">open</span>
                        {st.overdue > 0 && <> · <b style={{ color: 'var(--red)' }}>{st.overdue}</b> <span className="muted">overdue</span></>}
                      </span>
                      <span className="muted">{pct}%</span>
                    </div>
                    <div className="load-bar"><span style={{ width: `${pct}%`, background: c.color }} /></div>
                  </div>

                  <AvatarStack ids={st.people} max={5} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={open} onClose={close} title="New client"
        footer={<>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" disabled={!valid} onClick={submit}>Create client</button>
        </>}
      >
        <form className="form-grid" onSubmit={submit}>
          <Field label="Client name"><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></Field>
          <Field label="Industry"><input className="input" value={form.industry} onChange={(e) => set({ industry: e.target.value })} /></Field>
          <div className="field span-2">
            <span className="label">Services</span>
            <div className="row row-wrap">
              {SERVICES.map((s) => (
                <label key={s} className={`check ${form.services.includes(s) ? 'on' : ''}`}>
                  <input type="checkbox" checked={form.services.includes(s)} onChange={() => toggleService(s)} />{s}
                </label>
              ))}
            </div>
          </div>
          <Field label="Account owner" className="span-2">
            <select className="select" value={form.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              <option value="">Select a person…</option>
              {owners.map((e) => <option key={e.id} value={e.id}>{e.name}{e.title ? ` — ${e.title}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Brief" className="span-2">
            <textarea className="textarea" rows={4} value={form.brief} onChange={(e) => set({ brief: e.target.value })} />
          </Field>
        </form>
      </Modal>
    </PageMotion>
  )
}
