import { useMemo, useState } from 'react'
import { Plus, Users, Building2, FolderKanban, ChartColumn, RotateCcw, Check, UserPlus, ListChecks, CircleAlert } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { TEAMS, SERVICES, STATUSES } from '../store/seed'
import { ROLE_LABEL } from '../lib/permissions'
import { daysUntil } from '../lib/date'
import { Avatar, AvatarStack, StatusBadge, Modal, Field, Empty, PageMotion, ClientTag } from '../components/ui'

const ROLE_TONE = { admin: 'tone-accent', head: 'tone-violet', employee: 'tone-grey' }
const WEEK = 7 * 24 * 3600000

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function Pill({ on, onChange, children }) {
  return (
    <label className={`check ${on ? 'on' : ''}`}>
      <input type="checkbox" checked={on} onChange={onChange} />
      {on && <Check size={13} />}
      {children}
    </label>
  )
}

export default function Admin() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const createEmployee = useStore((s) => s.createEmployee)
  const updateEmployee = useStore((s) => s.updateEmployee)
  const createClient = useStore((s) => s.createClient)
  const reassignClient = useStore((s) => s.reassignClient)
  const createProject = useStore((s) => s.createProject)
  const resetDemo = useStore((s) => s.resetDemo)
  const me = useCurrentUser()

  const [tab, setTab] = useState('employees')
  const [modal, setModal] = useState(null) // 'employee' | 'client' | 'project'
  const [justAdded, setJustAdded] = useState(null)

  const [emp, setEmp] = useState({})
  const [cli, setCli] = useState({})
  const [prj, setPrj] = useState({})

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees])
  const leaders = useMemo(() => activeEmployees.filter((e) => e.role === 'head' || e.role === 'admin'), [activeEmployees])
  const byId = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])

  const isOpen = (t) => t.status !== 'done'
  const isOverdue = (t) => isOpen(t) && t.due && daysUntil(t.due) < 0

  const stats = useMemo(() => ({
    open: tasks.filter(isOpen).length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks])

  const openByPerson = useMemo(() => {
    const m = {}
    tasks.forEach((t) => { if (isOpen(t)) m[t.assigneeId] = (m[t.assigneeId] || 0) + 1 })
    return m
  }, [tasks])

  const workload = useMemo(() => {
    const now = Date.now()
    return activeEmployees.map((e) => {
      const mine = tasks.filter((t) => t.assigneeId === e.id)
      const seg = { todo: 0, progress: 0, review: 0 }
      mine.forEach((t) => { if (t.status in seg) seg[t.status]++ })
      return {
        e, seg,
        open: seg.todo + seg.progress + seg.review,
        overdue: mine.filter(isOverdue).length,
        done7: mine.filter((t) => t.status === 'done' && t.completedAt && now - t.completedAt <= WEEK).length,
      }
    }).sort((a, b) => b.open - a.open)
  }, [activeEmployees, tasks])

  const clientStats = useMemo(() => clients.map((c) => {
    const mine = tasks.filter((t) => t.clientId === c.id)
    return { c, open: mine.filter(isOpen).length, overdue: mine.filter(isOverdue).length, done: mine.filter((t) => t.status === 'done').length }
  }), [clients, tasks])

  const maxOpen = Math.max(1, ...workload.map((w) => w.open))

  const openModal = (kind) => {
    if (kind === 'employee') setEmp({ name: '', title: '', team: TEAMS[0], role: 'employee', headId: leaders[0]?.id ?? '', password: 'demo123' })
    if (kind === 'client') setCli({ name: '', industry: '', services: [], ownerId: leaders[0]?.id ?? activeEmployees[0]?.id ?? '', brief: '' })
    if (kind === 'project') setPrj({ clientId: clients[0]?.id ?? '', name: '', service: SERVICES[0], memberIds: [] })
    setModal(kind)
  }

  const saveEmployee = () => {
    if (!emp.name.trim()) return
    const id = createEmployee({ ...emp, password: emp.password || 'demo123' })
    setJustAdded({ id, name: emp.name.trim() })
    setModal(null)
  }
  const saveClient = () => {
    if (!cli.name.trim() || !cli.ownerId) return
    createClient(cli)
    setModal(null)
  }
  const saveProject = () => {
    if (!prj.name.trim() || !prj.clientId) return
    createProject(prj)
    setModal(null)
  }

  const reset = () => {
    if (window.confirm('Reset all demo data? This replaces everything with the original sample data.')) resetDemo()
  }

  const footer = (onSave, label) => (
    <>
      <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
      <button className="btn btn-primary" onClick={onSave}>{label}</button>
    </>
  )

  return (
    <PageMotion>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <div className="page-sub">Manage people, clients and projects.</div>
        </div>
        <button className="btn btn-ghost" onClick={reset}><RotateCcw size={15} /> Reset demo data</button>
      </div>

      <div className="grid grid-4">
        <div className="card stat"><div className="stat-label"><Users /> Active employees</div><div className="stat-value">{activeEmployees.length}</div></div>
        <div className="card stat"><div className="stat-label"><Building2 /> Clients</div><div className="stat-value">{clients.length}</div></div>
        <div className="card stat"><div className="stat-label"><ListChecks /> Open tasks</div><div className="stat-value">{stats.open}</div></div>
        <div className={`card stat ${stats.overdue ? 'is-alert' : ''}`}><div className="stat-label"><CircleAlert /> Overdue tasks</div><div className="stat-value">{stats.overdue}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}><Users /> Employees</button>
        <button className={`tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}><Building2 /> Clients</button>
        <button className={`tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}><FolderKanban /> Projects</button>
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}><ChartColumn /> Reports</button>
      </div>

      {tab === 'employees' && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="small muted">{employees.length} people</div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('employee')}><UserPlus size={15} /> Add employee</button>
          </div>
          {justAdded && (
            <div className="small" style={{ color: 'var(--green)', fontWeight: 600 }}>
              <Check size={14} style={{ verticalAlign: '-2px' }} /> {justAdded.name} added. Their employee ID is <span className="mono">{justAdded.id}</span>.
            </div>
          )}
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Person</th><th>Employee ID</th><th>Team</th><th>Role</th><th>Reports to</th><th>Open tasks</th><th>Status</th><th /></tr></thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar id={e.id} size={30} />
                        <div><b>{e.name}</b><div className="tiny muted">{e.title}</div></div>
                      </div>
                    </td>
                    <td className="mono">{e.id}</td>
                    <td>{e.team}</td>
                    <td><span className={`badge ${ROLE_TONE[e.role]}`}>{ROLE_LABEL[e.role]}</span></td>
                    <td>{byId[e.headId]?.name ?? <span className="muted">—</span>}</td>
                    <td>{openByPerson[e.id] || 0}</td>
                    <td><span className={`badge ${e.active ? 'tone-green' : 'tone-grey'}`}>{e.active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {e.id !== me?.id && (
                        <button className="btn btn-ghost btn-sm" onClick={() => updateEmployee(e.id, { active: !e.active })}>
                          {e.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="small muted">{clients.length} clients</div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('client')}><Plus size={15} /> Add client</button>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Client</th><th>Industry</th><th>Services</th><th>Account owner</th><th>Open tasks</th></tr></thead>
              <tbody>
                {clientStats.map(({ c, open }) => (
                  <tr key={c.id}>
                    <td><div className="row" style={{ gap: 8 }}><span className="client-dot" style={{ background: c.color }} /><b>{c.name}</b></div></td>
                    <td>{c.industry || <span className="muted">—</span>}</td>
                    <td><div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{c.services.map((s) => <span key={s} className="chip">{s}</span>)}</div></td>
                    <td>
                      <select className="select select-sm" value={c.ownerId} onChange={(ev) => reassignClient(c.id, ev.target.value)}>
                        {activeEmployees.concat(activeEmployees.some((e) => e.id === c.ownerId) ? [] : [byId[c.ownerId]].filter(Boolean)).map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>{open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="small muted">{projects.length} projects</div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('project')}><Plus size={15} /> Add project</button>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Project</th><th>Client</th><th>Service</th><th>Members</th><th>Tasks done</th></tr></thead>
              <tbody>
                {projects.map((p) => {
                  const pt = tasks.filter((t) => t.projectId === p.id)
                  return (
                    <tr key={p.id}>
                      <td><b>{p.name}</b></td>
                      <td><ClientTag clientId={p.clientId} /></td>
                      <td><span className="badge tone-grey">{p.service}</span></td>
                      <td><AvatarStack ids={p.memberIds} /></td>
                      <td>{pt.filter((t) => t.status === 'done').length} / {pt.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Workload &amp; delivery by person</h3></div>
            <div className="card-body">
              <div className="row small muted" style={{ gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                {[['To do', 'var(--grey)'], ['In progress', 'var(--blue)'], ['In review', 'var(--amber)']].map(([l, c]) => (
                  <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
                ))}
              </div>
              {workload.length === 0 ? <Empty icon={Users} title="No active employees" /> : (
                <div className="stack">
                  {workload.map(({ e, seg, open, overdue, done7 }) => (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1.1fr) 2fr auto', gap: 16, alignItems: 'center' }}>
                      <div className="row" style={{ gap: 10, minWidth: 0 }}>
                        <Avatar id={e.id} size={28} />
                        <div style={{ minWidth: 0 }}><b className="truncate">{e.name}</b><div className="tiny muted truncate">{e.title}</div></div>
                      </div>
                      <div className="load-bar" style={{ width: `${Math.max(8, (open / maxOpen) * 100)}%` }}>
                        {open > 0 && [['todo', 'var(--grey)'], ['progress', 'var(--blue)'], ['review', 'var(--amber)']].map(([k, col]) => (
                          seg[k] > 0 ? <span key={k} style={{ width: `${(seg[k] / open) * 100}%`, background: col }} title={`${STATUSES.find((s) => s.id === k).label}: ${seg[k]}`} /> : null
                        ))}
                      </div>
                      <div className="row small" style={{ gap: 16, whiteSpace: 'nowrap' }}>
                        <span><b>{open}</b> <span className="muted">open</span></span>
                        <span style={overdue > 0 ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{overdue} <span className={overdue > 0 ? '' : 'muted'}>overdue</span></span>
                        <span><b>{done7}</b> <span className="muted">done (7d)</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>By client</h3></div>
            <div className="card-body table-wrap">
              <table className="table">
                <thead><tr><th>Client</th><th>Open</th><th>Overdue</th><th>Done</th></tr></thead>
                <tbody>
                  {clientStats.map(({ c, open, overdue, done }) => (
                    <tr key={c.id}>
                      <td><ClientTag clientId={c.id} /></td>
                      <td>{open}</td>
                      <td style={overdue > 0 ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{overdue}</td>
                      <td>{done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal === 'employee'} onClose={() => setModal(null)} title="Add employee" footer={footer(saveEmployee, 'Add employee')}>
        <div className="form-grid">
          <Field label="Full name" className="span-2"><input className="input" autoFocus value={emp.name ?? ''} onChange={(e) => setEmp({ ...emp, name: e.target.value })} /></Field>
          <Field label="Job title"><input className="input" value={emp.title ?? ''} onChange={(e) => setEmp({ ...emp, title: e.target.value })} /></Field>
          <Field label="Team">
            <select className="select" value={emp.team ?? ''} onChange={(e) => setEmp({ ...emp, team: e.target.value })}>
              {TEAMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select className="select" value={emp.role ?? 'employee'} onChange={(e) => setEmp({ ...emp, role: e.target.value })}>
              {['employee', 'head', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="Reports to">
            <select className="select" value={emp.headId ?? ''} onChange={(e) => setEmp({ ...emp, headId: e.target.value })}>
              <option value="">Nobody</option>
              {leaders.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Temporary password" className="span-2" hint="They'll use this with their new employee ID to log in.">
            <input className="input" value={emp.password ?? ''} onChange={(e) => setEmp({ ...emp, password: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={modal === 'client'} onClose={() => setModal(null)} title="Add client" footer={footer(saveClient, 'Add client')}>
        <div className="form-grid">
          <Field label="Client name"><input className="input" autoFocus value={cli.name ?? ''} onChange={(e) => setCli({ ...cli, name: e.target.value })} /></Field>
          <Field label="Industry"><input className="input" value={cli.industry ?? ''} onChange={(e) => setCli({ ...cli, industry: e.target.value })} /></Field>
          <div className="field span-2">
            <span className="label">Services</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {SERVICES.map((s) => <Pill key={s} on={(cli.services ?? []).includes(s)} onChange={() => setCli({ ...cli, services: toggle(cli.services ?? [], s) })}>{s}</Pill>)}
            </div>
          </div>
          <Field label="Account owner" className="span-2">
            <select className="select" value={cli.ownerId ?? ''} onChange={(e) => setCli({ ...cli, ownerId: e.target.value })}>
              {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Brief" className="span-2"><textarea className="textarea" rows={3} value={cli.brief ?? ''} onChange={(e) => setCli({ ...cli, brief: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={modal === 'project'} onClose={() => setModal(null)} title="Add project" footer={footer(saveProject, 'Add project')}>
        <div className="form-grid">
          <Field label="Client">
            <select className="select" value={prj.clientId ?? ''} onChange={(e) => setPrj({ ...prj, clientId: e.target.value })}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Service">
            <select className="select" value={prj.service ?? ''} onChange={(e) => setPrj({ ...prj, service: e.target.value })}>
              {SERVICES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Project name" className="span-2"><input className="input" autoFocus value={prj.name ?? ''} onChange={(e) => setPrj({ ...prj, name: e.target.value })} /></Field>
          <div className="field span-2">
            <span className="label">Members</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {activeEmployees.map((e) => <Pill key={e.id} on={(prj.memberIds ?? []).includes(e.id)} onChange={() => setPrj({ ...prj, memberIds: toggle(prj.memberIds ?? [], e.id) })}>{e.name}</Pill>)}
            </div>
          </div>
        </div>
      </Modal>
    </PageMotion>
  )
}
