import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore, useCurrentUser } from './store/useStore'
import { isAdmin, isLead, canSeePostCalendar } from './lib/permissions'
import Shell from './components/Shell'
import Login, { Splash } from './pages/Login'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import PostCalendar from './pages/PostCalendar'
import Team from './pages/Team'
import SearchPage from './pages/Search'
import Admin from './pages/Admin'

export default function App() {
  const user = useCurrentUser()
  const phase = useStore((s) => s.phase)
  const theme = useStore((s) => s.theme)
  const init = useStore((s) => s.init)

  useEffect(() => { init() }, [init])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  if (phase === 'loading') return <Splash />

  return (
    <BrowserRouter>
      {phase !== 'ready' || !user ? (
        <Routes><Route path="*" element={<Login />} /></Routes>
      ) : (
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="calendar" element={canSeePostCalendar(user) ? <PostCalendar /> : <Navigate to="/" replace />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="team" element={isLead(user) ? <Team /> : <Navigate to="/" replace />} />
            <Route path="admin" element={isAdmin(user) ? <Admin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  )
}
