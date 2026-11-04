import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import { useModules } from '../hooks/useModules.js'
import { summarize, useProgress } from '../hooks/useProgress.jsx'
import { useToast } from '../components/Toast.jsx'
import { Loading, PageHeader, ProgressBar, Stat } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'

const MIN_PASSWORD = 8

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Profile() {
  const { session, profile, profileLoading, updateName, updatePassword, signOut } = useAuth()
  const { modules, loading, error, reload } = useModules()
  const progress = useProgress()
  const toast = useToast()
  const authed = Boolean(isAuthEnabled() && session)

  const [name, setName] = useState(profile?.full_name || '')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMessage, setNameMessage] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)

  useEffect(() => { setName(profile?.full_name || '') }, [profile?.full_name])

  if (loading || error) return <Loading error={error} onRetry={reload} />

  const summary = summarize(modules, progress)
  const email = session?.user?.email || 'Local browser session'
  const displayName = profile?.full_name || (authed ? email.split('@')[0] : 'Anonymous learner')
  const role = profile?.role || 'student'
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null

  async function saveName(event) {
    event.preventDefault()
    if (nameBusy) return
    if (!name.trim()) {
      setNameMessage({ ok: false, text: 'Enter a display name first.' })
      return
    }
    setNameBusy(true)
    setNameMessage(null)
    try {
      await updateName(name.trim())
      setNameMessage({ ok: true, text: 'Display name saved.' })
      toast.success('Profile updated.')
    } catch (err) {
      setNameMessage({ ok: false, text: err.message })
    } finally {
      setNameBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    if (passwordBusy) return
    if (password.length < MIN_PASSWORD) {
      setPasswordMessage({ ok: false, text: `Password must be at least ${MIN_PASSWORD} characters.` })
      return
    }
    if (password !== confirm) {
      setPasswordMessage({ ok: false, text: 'Passwords do not match.' })
      return
    }
    setPasswordBusy(true)
    setPasswordMessage(null)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      setPasswordMessage({ ok: true, text: 'Password updated.' })
      toast.success('Password changed.')
    } catch (err) {
      setPasswordMessage({ ok: false, text: err.message })
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Your identity, your progress and the credentials attached to this account." />

      <section className="card p-5 sm:p-6" aria-label="Account">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-navy-900 text-xl font-semibold text-white">
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-ink">{displayName}</h2>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`badge ${role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}>{role}</span>
              {joined && <span className="text-slate-500">Member since {joined}</span>}
              {!authed && <span className="text-slate-500">Local mode — progress stays in this browser</span>}
            </div>
          </div>
          {authed && (
            <button type="button" className="btn shrink-0" onClick={signOut}>
              <Icon name="logout" size={15} />
              Sign out
            </button>
          )}
        </div>
        {authed && profileLoading && <p className="mt-3 text-xs text-slate-500">Refreshing profile…</p>}
      </section>

      <section aria-label="Your statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Completed" value={`${summary.completed}/${summary.total}`} icon="check" tone="brand" />
        <Stat label="Flags" value={summary.flags} icon="flag" />
        <Stat label="Fixes" value={summary.fixes} icon="code" />
        <Stat label="Points" value={summary.score} icon="trophy" />
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Progress</h2>
          <span className="text-sm text-slate-500">{summary.percent}%</span>
        </div>
        <ProgressBar value={summary.percent} className="mt-2" label="Overall progress" />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Display name</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Shown on the leaderboard and in the admin roster. Leave it blank to appear as a masked email address.</p>
          <form onSubmit={saveName} className="mt-4 space-y-3" noValidate>
            <div>
              <label className="label" htmlFor="profile-name">Name</label>
              <input
                id="profile-name" className="input" value={name} maxLength={60} placeholder="Your name"
                onChange={(event) => setName(event.target.value)} disabled={!authed || nameBusy}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!authed || nameBusy || !name.trim()}>
              {nameBusy ? 'Saving…' : 'Save name'}
            </button>
          </form>
          {!authed && <p className="mt-2 text-xs text-slate-500">Sign in to save a name to the cloud profile.</p>}
          {nameMessage && (
            <p role={nameMessage.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${nameMessage.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {nameMessage.text}
            </p>
          )}
        </section>

        {authed && (
          <section className="card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">Change password</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Use at least {MIN_PASSWORD} characters. You stay signed in after the change.</p>
            <form onSubmit={savePassword} className="mt-4 space-y-3" noValidate>
              <div>
                <label className="label" htmlFor="profile-password">New password</label>
                <input
                  id="profile-password" type="password" autoComplete="new-password" className="input"
                  value={password} onChange={(event) => setPassword(event.target.value)} maxLength={200}
                />
              </div>
              <div>
                <label className="label" htmlFor="profile-confirm">Confirm password</label>
                <input
                  id="profile-confirm" type="password" autoComplete="new-password" className="input"
                  value={confirm} onChange={(event) => setConfirm(event.target.value)} maxLength={200}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={passwordBusy}>
                {passwordBusy ? 'Updating…' : 'Update password'}
              </button>
            </form>
            {passwordMessage && (
              <p role={passwordMessage.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${passwordMessage.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                {passwordMessage.text}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
