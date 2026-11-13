import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun as SunIcon, ListChecks, Building2, CalendarDays, Users, Shield, LogOut, Moon, Plus, Search, Bell, CircleCheck, CircleAlert, FlaskConical } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { ROLE_LABEL, isAdmin, isLead, canSeePostCalendar } from '../lib/permissions'
import { isCloud } from '../lib/backend'
import { relTime, todayIso } from '../lib/date'
import { awayLabel, isAway } from '../lib/repeat'
import { Avatar, Empty, StatusBadge, ClientTag } from './ui'
import TaskDrawer from './TaskDrawer'
import NewTaskModal from './NewTaskModal'
import AwayForm from './AwayForm'

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

// quick search across tasks, clients and people; Enter opens the full search page
function QuickSearch() {
  const tasks = useStore((s) => s.tasks)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const openTask = useStore((s) => s.openTask)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  const r = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return null
    return {
      clients: clients.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 4),
      people: employees.filter((e) => e.name.toLowerCase().includes(t) || e.title.toLowerCase().includes(t)).slice(0, 3),
      tasks: tasks.filter((x) => x.title.toLowerCase().includes(t) || x.id.toLowerCase() === t).slice(0, 6),
    }
  }, [q, tasks, clients, employees])
  const go = (fn) => { fn(); setOpen(false); setQ('') }
  const nothing = r && !r.clients.length && !r.people.length && !r.tasks.length
  return (
    <div className="search" ref={ref}>
      <Search />
      <input className="input" placeholder="Search everything…" value={q} aria-label="Search"
        onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go(() => navigate(`/search?q=${encodeURIComponent(q.trim())}`)) }} />
      <AnimatePresence>
        {open && r && (
          <motion.div className="search-results" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {nothing && <div className="muted small" style={{ padding: 10 }}>No quick matches.</div>}
            {r.clients.map((c) => (
              <button key={c.id} className="search-item" onClick={() => go(() => navigate(`/clients/${c.id}`))}>
                <Building2 size={15} className="muted" /><div className="grow strong truncate">{c.name}</div><span className="muted tiny">Client</span>
              </button>
            ))}
            {r.people.map((e) => (
              <button key={e.id} className="search-item" onClick={() => go(() => navigate(`/tasks?person=${e.id}`))}>
                <Avatar id={e.id} size={22} /><div className="grow truncate"><span className="strong">{e.name}</span> <span className="muted small">{e.title}</span></div><span className="muted tiny">Person</span>
              </button>
            ))}
            {r.tasks.map((t) => (
              <button key={t.id} className="search-item" onClick={() => go(() => openTask(t.id))}>
                <div className="grow">
                  <div className="strong truncate">{t.title}</div>
                  <div className="muted small row">{t.clientId ? <ClientTag clientId={t.clientId} /> : 'Internal'}</div>
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
            <button className="search-item search-all" onClick={() => go(() => navigate(`/search?q=${encodeURIComponent(q.trim())}`))}>
              <Search size={15} />Search everything for “{q.trim()}” <span className="muted tiny" style={{ marginLeft: 'auto' }}>Enter</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Notifications() {
  const user = useCurrentUser()
  const activity = useStore((s) => s.activity)
  const employees = useStore((s) => s.employees)
  const lastSeen = useStore((s) => s.lastSeen[user.id] ?? 0)
  const markSeen = useStore((s) => s.markSeen)
  const openTask = useStore((s) => s.openTask)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  const mine = useMemo(() => activity.filter((a) => a.targetId === user.id && a.actorId !== user.id).sort((a, b) => b.at - a.at).slice(0, 15), [activity, user.id])
  const unread = mine.filter((a) => a.at > lastSeen).length
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'
  const me = user.name.split(' ')[0]
  const say = (a) => a.text.replace(new RegExp(` to ${me}(\\b| \\()`), ' to you$1')
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} onClick={() => { setOpen((o) => !o); if (!open) markSeen() }}>
        <Bell />{unread > 0 && <span className="notif-dot" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="pop" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
            <div className="pop-head"><h3>Notifications</h3><span className="muted small">For you</span></div>
            <div className="pop-list">
              {mine.length === 0 && <Empty icon={Bell} title="You're all caught up" text="New tasks and mentions show up here." />}
              {mine.map((a) => (
                <button key={a.id} className={`feed-item ${a.at > lastSeen ? 'unread' : ''}`} onClick={() => { if (a.taskId) openTask(a.taskId); setOpen(false) }}>
                  <Avatar id={a.actorId} size={30} />
                  <div className="grow">
                    <div className="feed-text"><b>{name(a.actorId)}</b> {say(a)}</div>
                    <div className="muted tiny">{relTime(a.at)}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className={`toast ${toast.tone === 'error' ? 'is-error' : ''}`} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
            {toast.tone === 'error' ? <CircleAlert /> : <CircleCheck />}{toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Shell() {
  const user = useCurrentUser()
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const logout = useStore((s) => s.logout)
  const openNewTask = useStore((s) => s.openNewTask)
  const openTask = useStore((s) => s.openTask)
  const tasks = useStore((s) => s.tasks)
  const rules = useStore((s) => s.rules)
  const clients = useStore((s) => s.clients)
  const runRepeats = useStore((s) => s.runRepeats)
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const contentRef = useRef(null)
  const [awayOpen, setAwayOpen] = useState(false)

  useEffect(() => { contentRef.current?.scrollTo(0, 0) }, [location.pathname])

  // repeating tasks: make what is due now, and again when the date changes while the app is open
  useEffect(() => { runRepeats() }, [rules, clients, runRepeats])
  useEffect(() => {
    let day = todayIso()
    const check = () => { if (todayIso() !== day) { day = todayIso(); runRepeats() } }
    const timer = setInterval(check, 60000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [runRepeats])

  // links in emails open the task: /?task=T-123
  useEffect(() => {
    const id = params.get('task')
    if (id && tasks.some((t) => t.id === id)) {
      openTask(id)
      params.delete('task')
      setParams(params, { replace: true })
    }
  }, [params, tasks, openTask, setParams])

  const myOpen = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').length
  const nav = [
    { to: '/', label: 'My Day', icon: SunIcon, end: true, count: myOpen },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/clients', label: 'Clients', icon: Building2 },
    ...(canSeePostCalendar(user) ? [{ to: '/calendar', label: 'Post Calendar', icon: CalendarDays }] : []),
    ...(isLead(user) ? [{ to: '/team', label: 'Team', icon: Users }] : []),
    ...(isAdmin(user) ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BM</div>
          <div><div className="brand-name">Team Hub</div><div className="brand-sub">Brandmaker333</div></div>
        </div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={n.label}>
            <n.icon /><span>{n.label}</span>
            {n.count > 0 && <span className="nav-count">{n.count}</span>}
          </NavLink>
        ))}
        <div className="side-foot">
          {!isCloud && <div className="demo-flag"><FlaskConical size={14} />Demo mode · saved in this browser only</div>}
          <button className="user-card" onClick={() => setAwayOpen(true)} title="Going on leave? Set your dates">
            <Avatar id={user.id} size={36} />
            <div className="grow">
              <div className="name truncate">{user.name}</div>
              <div className={`meta truncate ${isAway(user) ? 'is-away' : ''}`}>{isAway(user) ? awayLabel(user) : user.title || ROLE_LABEL[user.role]}</div>
            </div>
          </button>
          <div className="side-actions">
            <button onClick={toggleTheme}>{theme === 'dark' ? <SunIcon /> : <Moon />}{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button onClick={logout}><LogOut />Log out</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <QuickSearch />
          <div className="grow" />
          <button className="icon-btn mobile-only" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <SunIcon /> : <Moon />}</button>
          <Notifications />
          <button className="btn btn-primary" onClick={() => openNewTask()}><Plus /><span className="hide-sm">New task</span></button>
          <button className="icon-btn mobile-only" onClick={logout} aria-label="Log out"><LogOut /></button>
        </header>
        <div className="content" ref={contentRef}>
          <Outlet />
        </div>
      </div>

      <TaskDrawer />
      <NewTaskModal />
      <AwayForm personId={awayOpen ? user.id : null} onClose={() => setAwayOpen(false)} />
      <Toast />
    </div>
  )
}
