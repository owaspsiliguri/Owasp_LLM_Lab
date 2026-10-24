import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { MODES, useProgress } from '../hooks/useProgress.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'

const NAV = [
  ['/', 'Dashboard'], ['/labs', 'Labs'], ['/paths', 'Learning Paths'], ['/progress', 'Progress'],
  ['/leaderboard', 'Leaderboard'], ['/docs', 'Documentation'], ['/about', 'About'], ['/contribute', 'Contribute'],
]

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
}

function ModeSelect({ mode, setMode, className = '' }) {
  return (
    <label className={`flex items-center gap-2 text-sm text-fog-300 ${className}`}>
      <span className="hidden sm:inline">Mode</span>
      <select aria-label="Learning mode" value={mode} onChange={(e) => setMode(e.target.value)} className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-fog-100">
        {MODES.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
      </select>
    </label>
  )
}

export default function Layout() {
  const { mode, setMode } = useProgress()
  const { session, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const authed = Boolean(isAuthEnabled() && session)
  const isAdmin = authed && profile && profile.role === 'admin'
  const nav = isAdmin ? [...NAV, ['/admin', 'Admin']] : NAV
  const name = profile?.full_name || session?.user?.email || ''

  const links = (extra = '') => nav.map(([to, label]) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
      className={({ isActive }) => `rounded px-2.5 py-1 ${isActive ? 'bg-ink-700 text-fog-100' : 'text-fog-300 hover:bg-ink-800'} ${extra}`}>{label}</NavLink>
  ))

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="shrink-0 font-semibold tracking-tight">LLM Learning Lab</Link>
          <nav aria-label="Main" className="hidden flex-wrap gap-1 text-sm lg:flex">{links()}</nav>
          <div className="ml-auto flex items-center gap-3">
            <ModeSelect mode={mode} setMode={setMode} className="hidden sm:flex" />
            {authed && (
              <div className="flex items-center gap-2 text-sm">
                <Link to="/profile" title={session.user.email} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-ink-800">
                  <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold ${isAdmin ? 'border-warn-400/60 text-warn-400' : 'border-steel-400/60 text-steel-400'}`}>{initials(name)}</span>
                  <span className="hidden max-w-[9rem] truncate text-fog-300 md:inline">{name}</span>
                </Link>
                <button className="btn hidden md:inline-flex" onClick={() => signOut()}>Sign out</button>
              </div>
            )}
            <button className="btn lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? '✕' : '☰'}</button>
          </div>
        </div>
        {open && (
          <nav aria-label="Main mobile" className="border-t border-ink-700 px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1 text-sm">{links('py-1.5')}</div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-800 pt-3">
              <ModeSelect mode={mode} setMode={setMode} className="sm:hidden" />
              {authed ? (
                <div className="flex items-center gap-2">
                  <Link to="/profile" onClick={() => setOpen(false)} className="btn">Profile</Link>
                  <button className="btn" onClick={() => { setOpen(false); signOut() }}>Sign out</button>
                </div>
              ) : <span className="text-xs text-fog-500">Local mode — no account needed</span>}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-fog-500">
        Deliberately vulnerable training application. Run it locally only and never point these techniques at systems you do not own or have permission to test. Proposed by OWASP Siliguri; not an official OWASP project.
      </footer>
    </div>
  )
}
