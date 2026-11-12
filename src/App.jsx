import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore, useCurrentUser } from './store/useStore'
import Shell from './components/Shell'
import Login from './pages/Login'
import Home from './pages/Home'
import Board from './pages/Board'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import ActivityPage from './pages/Activity'
import Admin from './pages/Admin'

export default function App() {
  const user = useCurrentUser()
  const theme = useStore((s) => s.theme)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="board" element={<Board />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="admin" element={user.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  )
}
