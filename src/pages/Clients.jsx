import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Hourglass, TriangleAlert } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { SERVICES } from '../store/seed'
import { canManageClients, isLead } from '../lib/permissions'
import { daysUntil, shortDate, todayIso } from '../lib/date'
import { Avatar, AvatarStack, Empty, PageMotion } from '../components/ui'
import ClientForm from '../components/ClientForm'

export default function Clients() {
  const user = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const updates = useStore((s) => s.updates)
  const employees = useStore((s) => s.employees)
  const [scope, setScope] = useState(isLead(user) ? 'all' : 'mine')
  const [service, setService] = useState('')
  const [showPaused, setShowPaused] = useState(false)
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => clients
    .filter((c) => (showPaused ? !c.active : c.active))
    .filter((c) => scope === 'all' || c.memberIds?.includes(user.id))
    .filter((c) => !service || c.services?.includes(service))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const mine = tasks.filter((t) => t.clientId === c.id && t.status !== 'done')
      const last = updates.filter((u) => u.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0]
      return {
        c, open: mine.length,
        waiting: mine.filter((t) => t.status === 'waiting').length,
        overdue: mine.filter((t) => (daysUntil(t.due) ?? 1) < 0).length,
        last,
      }
    }), [clients, tasks, updates, scope, service, showPaused, user.id])

  const name = (id) => employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <PageMotion>
      <div className="page-head">
        <div><h1>Clients</h1><p className="page-sub">{rows.length} {showPaused ? 'paused' : 'active'} client{rows.length === 1 ? '' : 's'}</p></div>
        {canManageClients(user) && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus />Add client</button>}
      </div>

      <div className="toolbar">
        <div className="seg">
          <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>My clients</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All clients</button>
        </div>
        <select className="select select-sm" value={service} onChange={(e) => setService(e.target.value)} aria-label="Service">
          <option value="">All services</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="grow" />
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPaused((x) => !x)}>{showPaused ? 'Show active clients' : 'Show paused clients'}</button>
      </div>

      {rows.length === 0 ? <div className="card"><Empty icon={Building2} title="No clients here" text={scope === 'mine' ? 'You are not on any client yet. Switch to All clients.' : 'Try another filter.'} /></div> : (
        <div className="grid grid-auto">
          {rows.map(({ c, open, waiting, overdue, last }) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="card card-hover client-card">
              <div className="row between">
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <span className="client-mark" style={{ background: c.color }}>{c.name.replace(/^the /i, '')[0]}</span>
                  <div style={{ minWidth: 0 }}><div className="strong truncate">{c.name}</div><div className="tiny muted truncate">{c.services.join(' · ') || 'No services set'}</div></div>
                </div>
                <AvatarStack ids={c.memberIds ?? []} max={3} size={24} />
              </div>
              <div className="row small soft" style={{ gap: 6 }}><Avatar id={c.ownerId} size={18} />{name(c.ownerId)}<span className="muted">· account manager</span></div>
              {(c.deliverables || c.ads) && <div className="tiny muted clamp-2">{[c.deliverables, c.ads && `Ads: ${c.ads}`].filter(Boolean).join(' · ')}</div>}
              <div className="row row-wrap" style={{ gap: 6, marginTop: 'auto' }}>
                <span className="badge tone-grey">{open} open</span>
                {waiting > 0 && <span className="badge tone-amber"><Hourglass />{waiting} waiting</span>}
                {overdue > 0 && <span className="badge tone-red"><TriangleAlert />{overdue} overdue</span>}
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>{last ? `Updated ${last.date === todayIso() ? 'today' : shortDate(last.date)}` : 'No updates yet'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <ClientForm open={adding} client={null} onClose={() => setAdding(false)} />
    </PageMotion>
  )
}
