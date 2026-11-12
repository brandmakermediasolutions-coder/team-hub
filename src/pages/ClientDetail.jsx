import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Building2, Pencil, Check, X, ArrowRightLeft, FolderKanban } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { SERVICES } from '../store/seed'
import { visibleClients, visibleTasks, canManageClients, assignableEmployees } from '../lib/permissions'
import { formatDate, relTime } from '../lib/date'
import { Avatar, AvatarStack, Modal, Field, Empty, PageMotion, TaskRow } from '../components/ui'

const colsCss = `
.client-cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 1000px) { .client-cols { grid-template-columns: minmax(0, 1fr); } }
`

export default function ClientDetail() {
  const { id } = useParams()
  const user = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const activity = useStore((s) => s.activity)
  const openNewTask = useStore((s) => s.openNewTask)
  const reassignClient = useStore((s) => s.reassignClient)
  const updateClient = useStore((s) => s.updateClient)
  const createProject = useStore((s) => s.createProject)

  const [reassignOpen, setReassignOpen] = useState(false)
  const [newOwner, setNewOwner] = useState('')
  const [note, setNote] = useState('')
  const [projOpen, setProjOpen] = useState(false)
  const [proj, setProj] = useState({ name: '', service: SERVICES[0], memberIds: [] })
  const [editBrief, setEditBrief] = useState(false)
  const [briefDraft, setBriefDraft] = useState('')

  const client = useMemo(() => visibleClients(user, clients, projects, tasks, employees).find((c) => c.id === id), [user, clients, projects, tasks, employees, id])
  const myTasks = useMemo(() => visibleTasks(user, tasks, employees), [user, tasks, employees])
  const clientProjects = useMemo(() => projects.filter((p) => p.clientId === id), [projects, id])
  const clientTasks = useMemo(() => myTasks.filter((t) => t.clientId === id), [myTasks, id])
  const looseTasks = useMemo(() => clientTasks.filter((t) => !t.projectId || !clientProjects.some((p) => p.id === t.projectId)), [clientTasks, clientProjects])
  const teamIds = useMemo(() => [...new Set(clientProjects.flatMap((p) => p.memberIds))], [clientProjects])
  const recent = useMemo(() => activity.filter((a) => a.clientId === id).slice(0, 8), [activity, id])
  const assignable = useMemo(() => assignableEmployees(user, employees), [user, employees])
  const allActive = useMemo(() => employees.filter((e) => e.active), [employees])

  if (!client) {
    return (
      <PageMotion>
        <div className="card">
          <Empty icon={Building2} title="Client not found" text="It may not exist, or you may not have access to it.">
            <Link to="/clients" className="btn btn-sm" style={{ marginTop: 10 }}><ArrowLeft size={14} /> Back to clients</Link>
          </Empty>
        </div>
      </PageMotion>
    )
  }

  const manage = canManageClients(user)
  const owner = employees.find((e) => e.id === client.ownerId)
  const emp = (eid) => employees.find((e) => e.id === eid)
  const counts = (ts) => {
    const done = ts.filter((t) => t.status === 'done').length
    return `${ts.length - done} open · ${done} done`
  }

  const openReassign = () => { setNewOwner(client.ownerId); setNote(''); setReassignOpen(true) }
  const doReassign = () => {
    if (newOwner && newOwner !== client.ownerId) reassignClient(client.id, newOwner, note)
    setReassignOpen(false)
  }
  const toggleMember = (mid) => setProj((p) => ({ ...p, memberIds: p.memberIds.includes(mid) ? p.memberIds.filter((x) => x !== mid) : [...p.memberIds, mid] }))
  const closeProj = () => { setProjOpen(false); setProj({ name: '', service: SERVICES[0], memberIds: [] }) }
  const doProject = () => {
    if (!proj.name.trim()) return
    createProject({ ...proj, clientId: client.id })
    closeProj()
  }
  const saveBrief = () => { updateClient(client.id, { brief: briefDraft }); setEditBrief(false) }

  return (
    <PageMotion>
      <style>{colsCss}</style>

      <Link to="/clients" className="small muted row" style={{ gap: 6, textDecoration: 'none', width: 'fit-content' }}>
        <ArrowLeft size={14} /> Clients
      </Link>

      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: client.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
            {client.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1>{client.name}</h1>
            <div className="row row-wrap" style={{ gap: 6, marginTop: 6 }}>
              <span className="small muted">{client.industry || 'No industry'}</span>
              {client.services.map((s) => <span key={s} className="chip">{s}</span>)}
              <span className="small muted">· since {formatDate(client.since)}</span>
            </div>
          </div>
        </div>
        <div className="row">
          {manage && <button className="btn" onClick={openReassign}><ArrowRightLeft size={15} /> Reassign client</button>}
          <button className="btn btn-primary" onClick={() => openNewTask({ clientId: client.id })}><Plus size={16} /> New task</button>
        </div>
      </div>

      <div className="client-cols">
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="section-title">Projects</span>
            {manage && <button className="btn btn-sm" onClick={() => setProjOpen(true)}><Plus size={14} /> Add project</button>}
          </div>

          {clientProjects.length === 0 && looseTasks.length === 0 && (
            <div className="card"><Empty icon={FolderKanban} title="No projects yet" text="Add a project to start organising this client's work." /></div>
          )}

          {clientProjects.map((p) => {
            const ts = clientTasks.filter((t) => t.projectId === p.id)
            return (
              <div key={p.id} className="card">
                <div className="card-head">
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <b className="truncate">{p.name}</b>
                    <span className="badge tone-blue">{p.service}</span>
                  </div>
                  <AvatarStack ids={p.memberIds} max={4} size={24} />
                </div>
                <div className="card-body">
                  <div className="small muted" style={{ marginBottom: 8 }}>{counts(ts)}</div>
                  {ts.length === 0 ? <div className="small muted">No tasks yet.</div> : (
                    <div className="stack" style={{ gap: 2 }}>
                      {ts.map((t) => <TaskRow key={t.id} task={t} showAssignee />)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {looseTasks.length > 0 && (
            <div className="card">
              <div className="card-head"><b>Other tasks</b><span className="small muted">{counts(looseTasks)}</span></div>
              <div className="card-body">
                <div className="stack" style={{ gap: 2 }}>
                  {looseTasks.map((t) => <TaskRow key={t.id} task={t} showAssignee />)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <span className="section-title">Client brief</span>
              {manage && !editBrief && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setBriefDraft(client.brief ?? ''); setEditBrief(true) }}><Pencil size={13} /> Edit</button>
              )}
              {manage && editBrief && (
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditBrief(false)}><X size={13} /> Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveBrief}><Check size={13} /> Save</button>
                </div>
              )}
            </div>
            <div className="card-body">
              {editBrief
                ? <textarea className="textarea" rows={6} value={briefDraft} onChange={(e) => setBriefDraft(e.target.value)} autoFocus />
                : <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{client.brief || <span className="muted">No brief yet.</span>}</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="section-title">Account owner</span></div>
            <div className="card-body">
              <div className="row" style={{ gap: 10 }}>
                <Avatar id={client.ownerId} size={36} />
                <div>
                  <div style={{ fontWeight: 600 }}>{owner?.name ?? 'Unassigned'}</div>
                  <div className="small muted">{owner?.title}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="section-title">Team</span></div>
            <div className="card-body">
              {teamIds.length === 0 ? <div className="small muted">No one on this client's projects yet.</div> : (
                <div className="stack" style={{ gap: 10 }}>
                  {teamIds.map((tid) => (
                    <div key={tid} className="row" style={{ gap: 10 }}>
                      <Avatar id={tid} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 550 }}>{emp(tid)?.name}</div>
                        <div className="small muted truncate">{emp(tid)?.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="section-title">Recent activity</span></div>
            <div className="card-body">
              {recent.length === 0 ? <div className="small muted">Nothing yet.</div> : (
                <div className="stack" style={{ gap: 12 }}>
                  {recent.map((a) => (
                    <div key={a.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <Avatar id={a.actorId} size={24} />
                      <div style={{ minWidth: 0 }}>
                        <div className="small"><b>{emp(a.actorId)?.name ?? 'Someone'}</b> {a.text}</div>
                        <div className="small muted">{relTime(a.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign client"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setReassignOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={!newOwner || newOwner === client.ownerId} onClick={doReassign}>Reassign</button>
        </>}
      >
        <div className="stack">
          <Field label="New account owner">
            <select className="select" value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
              {assignable.map((e) => <option key={e.id} value={e.id}>{e.name}{e.title ? ` — ${e.title}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Handover note" hint="Shared in the activity feed.">
            <textarea className="textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={projOpen} onClose={closeProj} title="Add project"
        footer={<>
          <button className="btn btn-ghost" onClick={closeProj}>Cancel</button>
          <button className="btn btn-primary" disabled={!proj.name.trim()} onClick={doProject}>Create project</button>
        </>}
      >
        <div className="stack">
          <Field label="Project name"><input className="input" value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} autoFocus /></Field>
          <Field label="Service">
            <select className="select" value={proj.service} onChange={(e) => setProj({ ...proj, service: e.target.value })}>
              {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="field">
            <span className="label">Members</span>
            <div className="row row-wrap">
              {allActive.map((e) => (
                <label key={e.id} className={`check ${proj.memberIds.includes(e.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={proj.memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} />{e.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </PageMotion>
  )
}
