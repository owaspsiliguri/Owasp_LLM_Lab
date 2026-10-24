import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import { useModules } from '../hooks/useModules.js'
import { summarize, useProgress } from '../hooks/useProgress.jsx'
import { Loading, Stat } from '../components/ui.jsx'

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()
}

export default function Profile() {
  const { session, profile, updateName, updatePassword, signOut } = useAuth()
  const { modules, loading, error } = useModules()
  const progress = useProgress()
  const authed = Boolean(isAuthEnabled() && session)

  const [name, setName] = useState(profile?.full_name || '')
  const [nameMsg, setNameMsg] = useState(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading || error) return <Loading error={error} />
  const s = summarize(modules, progress)
  const email = session?.user?.email || 'Local browser session'
  const displayName = profile?.full_name || (authed ? session.user.email.split('@')[0] : 'Anonymous learner')
  const role = profile?.role || 'student'
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : null

  async function saveName(e) {
    e.preventDefault()
    setBusy(true); setNameMsg(null)
    try { await updateName(name); setNameMsg({ ok: true, text: 'Display name saved.' }) }
    catch (err) { setNameMsg({ ok: false, text: err.message }) }
    finally { setBusy(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwMsg(null)
    if (pw.length < 8) { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    if (pw !== pw2) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    setBusy(true)
    try { await updatePassword(pw); setPw(''); setPw2(''); setPwMsg({ ok: true, text: 'Password updated.' }) }
    catch (err) { setPwMsg({ ok: false, text: err.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="panel flex flex-wrap items-center gap-4 p-5">
        <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full border-2 border-steel-400/60 text-xl font-semibold text-steel-400">{initials(displayName)}</span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{displayName}</h1>
          <p className="truncate text-sm text-fog-500">{email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded border px-1.5 py-0.5 uppercase ${role === 'admin' ? 'border-warn-400/60 text-warn-400' : 'border-steel-400/60 text-steel-400'}`}>{role}</span>
            {joined && <span className="text-fog-500">Member since {joined}</span>}
            {!authed && <span className="text-fog-500">Local mode — progress stays in this browser</span>}
          </div>
        </div>
        {authed && <button className="btn ml-auto" onClick={() => signOut()}>Sign out</button>}
      </header>

      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Modules completed" value={`${s.completed}/${s.total}`} />
        <Stat label="Flags captured" value={s.flags} />
        <Stat label="Fix-It solved" value={s.fixes} />
        <Stat label="Overall progress" value={`${s.percent}%`} />
      </section>

      <section className="panel p-5">
        <h2 className="font-medium">Display name</h2>
        <p className="mt-1 text-sm text-fog-500">Shown on the leaderboard and in the admin roster.</p>
        <form onSubmit={saveName} className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Display name" className="input max-w-xs flex-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <button className="btn btn-primary" type="submit" disabled={!authed || busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
        {!authed && <p className="mt-2 text-xs text-fog-500">Sign in to save your name to the cloud profile.</p>}
        {nameMsg && <p role="status" className={`mt-2 text-sm ${nameMsg.ok ? 'text-safe-400' : 'text-vuln-400'}`}>{nameMsg.text}</p>}
      </section>

      {authed && (
        <section className="panel p-5">
          <h2 className="font-medium">Change password</h2>
          <form onSubmit={savePassword} className="mt-3 space-y-2">
            <label className="block text-sm text-fog-300">New password
              <input aria-label="New password" type="password" className="input mt-1" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="block text-sm text-fog-300">Confirm password
              <input aria-label="Confirm password" type="password" className="input mt-1" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>Update password</button>
          </form>
          {pwMsg && <p role="status" className={`mt-2 text-sm ${pwMsg.ok ? 'text-safe-400' : 'text-vuln-400'}`}>{pwMsg.text}</p>}
        </section>
      )}
    </div>
  )
}
