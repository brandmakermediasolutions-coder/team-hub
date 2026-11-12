import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, Columns3, Building2, Activity, Shield, LogOut, Sun, Moon, Plus, Search, Bell, CircleCheck } from 'lucide-react'
import { useStore, useCurrentUser } from '../store/useStore'
import { ROLE_LABEL, visibleTasks } from '../lib/permissions'
import { relTime } from '../lib/date'
import { Avatar, Empty, StatusBadge, ClientTag } from './ui'
import TaskDrawer from './TaskDrawer'
import NewTaskModal from './NewTaskModal'

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

function TaskSearch() {
  const user = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const employees = useStore((s) => s.employees)
  const openTask = useStore((s) => s.openTask)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return visibleTasks(user, tasks, employees).filter((x) => x.title.toLowerCase().includes(t) || x.id.toLowerCase().includes(t)).slice(0, 7)
  }, [q, user, tasks, employees])
  return (
    <div className="search" ref={ref}>
      <Search />
      <input className="input" placeholder="Search tasks…" value={q} aria-label="Search tasks"
        onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} />
      <AnimatePresence>
        {open && q.trim() && (
          <motion.div className="search-results" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {results.length === 0 && <div className="muted small" style={{ padding: 12 }}>No tasks match “{q}”.</div>}
            {results.map((t) => (
              <button key={t.id} className="search-item" onClick={() => { openTask(t.id); setOpen(false); setQ('') }}>
                <div className="grow">
                  <div className="strong truncate">{t.title}</div>
                  <div className="muted small row"><span className="mono">{t.id}</span>{t.clientId && <ClientTag clientId={t.clientId} />}</div>
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
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
  const mine = useMemo(() => activity.filter((a) => a.targetId === user.id && a.actorId !== user.id).slice(0, 12), [activity, user.id])
  const unread = mine.filter((a) => a.at > lastSeen).length
  const name = (id) => employees.find((e) => e.id === id)?.name ?? 'Someone'
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
              {mine.length === 0 && <Empty icon={Bell} title="You're all caught up" text="New assignments and mentions show up here." />}
              {mine.map((a) => (
                <button key={a.id} className="feed-item" onClick={() => { if (a.taskId) openTask(a.taskId); setOpen(false) }}>
                  <Avatar id={a.actorId} size={30} />
                  <div className="grow">
                    <div className="feed-text"><b>{name(a.actorId)}</b> {a.text}</div>
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
          <motion.div key={toast.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
            <CircleCheck />{toast.message}
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
  const tasks = useStore((s) => s.tasks)
  const location = useLocation()
  const contentRef = useRef(null)

  useEffect(() => { contentRef.current?.scrollTo(0, 0) }, [location.pathname])

  const myOpen = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done').length
  const nav = [
    { to: '/', label: 'My Home', icon: LayoutDashboard, end: true, count: myOpen },
    { to: '/board', label: user.role === 'employee' ? 'My Board' : 'Team Board', icon: Columns3 },
    { to: '/clients', label: 'Clients', icon: Building2 },
    { to: '/activity', label: 'Activity', icon: Activity },
    ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BM</div>
          <div><div className="brand-name">Team Hub</div><div className="brand-sub">Brandmaker333</div></div>
        </div>
        <div className="nav-label">Workspace</div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={n.label}>
            <n.icon /><span>{n.label}</span>
            {n.count > 0 && <span className="nav-count">{n.count}</span>}
          </NavLink>
        ))}
        <div className="side-foot">
          <div className="user-card">
            <Avatar id={user.id} size={36} />
            <div className="grow">
              <div className="name truncate">{user.name}</div>
              <div className="meta truncate">{user.id} · {ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <div className="side-actions">
            <button onClick={toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />}{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button onClick={logout}><LogOut />Log out</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <TaskSearch />
          <div className="grow" />
          <button className="icon-btn mobile-only" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun /> : <Moon />}</button>
          <Notifications />
          <button className="btn btn-primary" onClick={() => openNewTask()}><Plus />New task</button>
          <button className="icon-btn mobile-only" onClick={logout} aria-label="Log out"><LogOut /></button>
        </header>
        <div className="content" ref={contentRef}>
          <Outlet />
        </div>
      </div>

      <TaskDrawer />
      <NewTaskModal />
      <Toast />
    </div>
  )
}
