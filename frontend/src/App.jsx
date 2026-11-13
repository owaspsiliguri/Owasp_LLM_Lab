import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Icon from './components/Icons.jsx'
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
import Courses from './pages/Courses.jsx'
import Course from './pages/Course.jsx'
import { useAuth } from './hooks/useAuth.jsx'

function SessionLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-mist px-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-brand-600" aria-hidden />
        Restoring your session…
      </div>
    </div>
  )
}

function Root() {
  const { enabled, user, loading } = useAuth()
  // Wait for /auth/config before deciding: the initial state is "disabled",
  // so redirecting or showing Home first would flash the wrong page and, on a
  // hard reload, strand an administrator who opened /admin directly.
  if (loading) return <SessionLoading />
  if (!enabled) return <Dashboard />
  return user ? <Dashboard /> : <Home />
}

function RequireAuth({ children }) {
  const { enabled, user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SessionLoading />
  if (!enabled) return children
  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  return children
}

function RequireAdmin({ children }) {
  const { enabled, user, profile, loading } = useAuth()
  if (loading) return <SessionLoading />
  if (!enabled) return <Navigate to="/" replace />
  if (!user) return <Navigate to="/login" replace />
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon name="search" size={22} />
      </span>
      <h1 className="mt-4 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">That route is not part of the range. The labs are still where you left them.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link className="btn btn-primary" to="/labs">Browse labs</Link>
        <Link className="btn" to="/">Back to dashboard</Link>
      </div>
    </div>
  )
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
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:slug" element={<Course />} />
        <Route path="progress" element={<RequireAuth><Progress /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="about" element={<About />} />
        <Route path="contribute" element={<Contribute />} />
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
