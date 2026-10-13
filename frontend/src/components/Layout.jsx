import { NavLink, Outlet } from 'react-router-dom'
import { MODES, useProgress } from '../hooks/useProgress.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'

const NAV = [['/', 'Dashboard'], ['/labs', 'Labs'], ['/paths', 'Learning Paths'], ['/progress', 'Progress'], ['/docs', 'Documentation'], ['/about', 'About'], ['/contribute', 'Contribute']]

export default function Layout() {
  const { mode, setMode } = useProgress()
  const { session, profile, signOut } = useAuth()
  const authed = Boolean(isAuthEnabled() && session)
  const isAdmin = authed && profile && profile.role === 'admin'
  const nav = isAdmin ? [...NAV, ['/admin', 'Admin']] : NAV

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-base font-semibold tracking-tight">LLM Learning Lab</span>
          <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded px-2.5 py-1 ${isActive ? 'bg-ink-700 text-fog-100' : 'text-fog-300 hover:bg-ink-800'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-fog-300">
              Mode
              <select aria-label="Learning mode" value={mode} onChange={(e) => setMode(e.target.value)} className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-fog-100">
                {MODES.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              </select>
            </label>
            {authed && (
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded border border-ink-600 px-1.5 py-0.5 text-xs uppercase text-fog-500">{isAdmin ? 'admin' : 'student'}</span>
                <span className="max-w-[14rem] truncate text-fog-500" title={session.user.email}>{session.user.email}</span>
                <button className="btn" onClick={() => signOut()}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-fog-500">
        Deliberately vulnerable training application. Run it locally only and never point these techniques at systems you do not own or have permission to test. Proposed by OWASP Siliguri; not an official OWASP project.
      </footer>
    </div>
  )
}
