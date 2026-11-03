import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Home from './pages/Home.jsx'
import Labs from './pages/Labs.jsx'
import Lab from './pages/Lab.jsx'
import Paths from './pages/Paths.jsx'
import Progress from './pages/Progress.jsx'
import About from './pages/About.jsx'
import Contribute from './pages/Contribute.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Profile from './pages/Profile.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import { isAuthEnabled } from './services/supabase.js'

function PleaseWait() {
  return <p className="p-8 text-fog-300">Loading your session…</p>
}

// Root: the public landing page for visitors, the dashboard once signed in.
// Without Supabase credentials there is no login, so the dashboard is the home.
function Root() {
  const { session, loading } = useAuth()
  if (!isAuthEnabled()) return <Dashboard />
  if (loading) return <PleaseWait />
  return session ? <Dashboard /> : <Home />
}

// Labs and personal pages require a session when Supabase is configured; in
// local mode (no Supabase credentials) the app stays fully open.
function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (!isAuthEnabled()) return children
  if (loading) return <PleaseWait />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function RequireAdmin({ children }) {
  const { session, profile, loading } = useAuth()
  if (!isAuthEnabled()) return <Navigate to="/" replace />
  if (loading) return <PleaseWait />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<Layout />}>
        <Route index element={<Root />} />
        <Route path="labs" element={<RequireAuth><Labs /></RequireAuth>} />
        <Route path="labs/:id" element={<RequireAuth><Lab /></RequireAuth>} />
        <Route path="paths" element={<RequireAuth><Paths /></RequireAuth>} />
        <Route path="progress" element={<RequireAuth><Progress /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="about" element={<About />} />
        <Route path="contribute" element={<Contribute />} />
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<p className="p-8">Page not found. <Link className="text-neon underline" to="/">Back home</Link></p>} />
      </Route>
    </Routes>
  )
}
