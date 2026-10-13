import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Labs from './pages/Labs.jsx'
import Lab from './pages/Lab.jsx'
import Paths from './pages/Paths.jsx'
import Progress from './pages/Progress.jsx'
import Docs from './pages/Docs.jsx'
import About from './pages/About.jsx'
import Contribute from './pages/Contribute.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import { isAuthEnabled } from './services/supabase.js'

function PleaseWait() {
  return <p className="p-8 text-fog-300">Loading your session…</p>
}

// All lab pages require a session when Supabase is configured; in local mode
// (no Supabase credentials) the app stays fully open.
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
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="labs" element={<Labs />} />
        <Route path="labs/:id" element={<Lab />} />
        <Route path="paths" element={<Paths />} />
        <Route path="progress" element={<Progress />} />
        <Route path="docs" element={<Docs />} />
        <Route path="about" element={<About />} />
        <Route path="contribute" element={<Contribute />} />
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<p className="p-8">Page not found.</p>} />
      </Route>
    </Routes>
  )
}
