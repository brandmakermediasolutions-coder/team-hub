import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Building2, ListChecks, PenLine, MessageSquare, Users, Loader2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { isCloud, searchUpdates } from '../lib/backend'
import { shortDate } from '../lib/date'
import { Avatar, ClientTag, Empty, PageMotion, StatusBadge } from '../components/ui'

function Hi({ text = '', q }) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

function Section({ icon: Icon, title, count, children }) {
  if (!count) return null
  return (
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 8 }}><h2 className="row"><Icon size={16} />{title}</h2><span className="muted small">{count}</span></div>
      <div style={{ padding: '0 10px 10px' }}>{children}</div>
    </div>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [input, setInput] = useState(q)
  const tasks = useStore((s) => s.tasks)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const updates = useStore((s) => s.updates)
  const comments = useStore((s) => s.comments)
  const openTask = useStore((s) => s.openTask)
  const [older, setOlder] = useState({ q: '', rows: [], loading: false })

  useEffect(() => { setInput(q) }, [q])

  const r = useMemo(() => {
    const t = q.toLowerCase()
    if (!t) return null
    const has = (s) => (s ?? '').toLowerCase().includes(t)
    const clientName = (id) => clients.find((c) => c.id === id)?.name ?? ''
    return {
      clients: clients.filter((c) => has(c.name) || has(c.brief) || has(c.deliverables) || has(c.ads)),
      people: employees.filter((e) => has(e.name) || has(e.title) || has(e.department) || has(e.email)),
      tasks: tasks.filter((x) => has(x.title) || has(x.notes) || x.id.toLowerCase() === t || has(clientName(x.clientId)))
        .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 80),
      updates: updates.filter((u) => has(u.text) || has(clientName(u.clientId))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80),
      comments: comments.filter((c) => has(c.text)).sort((a, b) => b.at - a.at).slice(0, 40),
    }
  }, [q, tasks, clients, employees, updates, comments])

  // older daily updates live only in the database
  useEffect(() => {
    if (!isCloud || q.length < 3) return
    let alive = true
    setOlder({ q, rows: [], loading: true })
    searchUpdates(q).then((rows) => alive && setOlder({ q, rows, loading: false })).catch(() => alive && setOlder({ q, rows: [], loading: false }))
    return () => { alive = false }
  }, [q])
  const olderOnly = older.q === q ? older.rows.filter((u) => !updates.some((x) => x.id === u.id)) : []
  const allUpdates = r ? [...r.updates, ...olderOnly] : []

  const total = r ? r.clients.length + r.people.length + r.tasks.length + allUpdates.length + r.comments.length : 0
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'

  return (
    <PageMotion>
      <div className="page-head"><div><h1>Search</h1><p className="page-sub">Tasks, clients, people, daily updates and comments.</p></div></div>
      <form className="search big" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }}>
        <SearchIcon />
        <input className="input" autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Try “Black Friday”, “approval”, a client or a person" />
      </form>

      {!q && <div className="card"><Empty icon={SearchIcon} title="Type something and press Enter" text="Search covers every task and the daily updates in the database." /></div>}
      {q && total === 0 && !older.loading && <div className="card"><Empty icon={SearchIcon} title={`Nothing found for “${q}”`} /></div>}
      {q && older.loading && <div className="muted small row"><Loader2 className="spin" size={14} />Searching older updates…</div>}

      {r && (
        <div className="stack" style={{ gap: 16 }}>
          <Section icon={Building2} title="Clients" count={r.clients.length}>
            {r.clients.map((c) => (
              <Link key={c.id} to={`/clients/${c.id}`} className="feed-item">
                <span className="client-mark" style={{ background: c.color }}>{c.name.replace(/^the /i, '')[0]}</span>
                <div className="grow"><div className="strong"><Hi text={c.name} q={q} /></div><div className="tiny muted">{c.services.join(' · ')}</div></div>
              </Link>
            ))}
          </Section>
          <Section icon={Users} title="People" count={r.people.length}>
            {r.people.map((e) => (
              <Link key={e.id} to={`/tasks?person=${e.id}`} className="feed-item">
                <Avatar id={e.id} size={30} />
                <div className="grow"><div className="strong"><Hi text={e.name} q={q} /></div><div className="tiny muted">{e.title} · {e.department}</div></div>
              </Link>
            ))}
          </Section>
          <Section icon={ListChecks} title="Tasks" count={r.tasks.length}>
            {r.tasks.map((t) => (
              <button key={t.id} className="feed-item" onClick={() => openTask(t.id)}>
                <Avatar id={t.assigneeId} size={28} />
                <div className="grow">
                  <div className="strong"><Hi text={t.title} q={q} /></div>
                  <div className="task-meta">{t.clientId ? <ClientTag clientId={t.clientId} /> : 'Internal'}<span className="sep" />{name(t.assigneeId)}</div>
                  {t.notes && t.notes.toLowerCase().includes(q.toLowerCase()) && <div className="small soft mt-4 clamp-2"><Hi text={t.notes} q={q} /></div>}
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
          </Section>
          <Section icon={PenLine} title="Daily updates" count={allUpdates.length}>
            {allUpdates.map((u) => (
              <div key={u.id} className="feed-item">
                <Avatar id={u.employeeId} size={28} />
                <div className="grow">
                  <div className="task-meta"><b className="soft">{name(u.employeeId)}</b><span className="sep" />{u.clientId ? <ClientTag clientId={u.clientId} /> : 'Internal'}<span className="sep" />{shortDate(u.date)}</div>
                  <div className="mt-4"><Hi text={u.text} q={q} /></div>
                </div>
              </div>
            ))}
          </Section>
          <Section icon={MessageSquare} title="Comments" count={r.comments.length}>
            {r.comments.map((c) => (
              <button key={c.id} className="feed-item" onClick={() => openTask(c.taskId)}>
                <Avatar id={c.authorId} size={28} />
                <div className="grow"><div className="tiny muted">{name(c.authorId)} on “{tasks.find((t) => t.id === c.taskId)?.title ?? 'a task'}”</div><div className="mt-4"><Hi text={c.text} q={q} /></div></div>
              </button>
            ))}
          </Section>
        </div>
      )}
    </PageMotion>
  )
}
