import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import AuthShell from '../components/AuthShell.jsx'
import Icon from '../components/Icons.jsx'

const MIN_PASSWORD = 8

function destinationFrom(state) {
  const from = state && typeof state.from === 'string' ? state.from : '/'
  return from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export default function Signup() {
  const { signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const redirectTo = destinationFrom(location.state)
  if (isAuthEnabled() && !loading && session) return <Navigate to={redirectTo} replace />

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await signUp({ fullName: fullName.trim(), email: address, password })
      if (result.needsConfirmation) setDone(true)
      else navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create the account. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      Already registered?{' '}
      <Link className="font-medium text-brand-700 underline decoration-brand-500/50 underline-offset-2" to="/login" state={{ from: redirectTo }}>
        Sign in
      </Link>
    </>
  )

  if (!isAuthEnabled()) {
    return (
      <AuthShell title="Create an account" subtitle="This deployment has no account system attached, so the lab is open." footer={footer}>
        <p className="text-sm leading-6 text-slate-600">
          Authentication is not configured here. Every lab runs in local mode and progress stays in this browser.
        </p>
        <Link className="btn btn-primary mt-5 w-full" to="/">Continue in local mode</Link>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell title="Check your email" subtitle="One click and you are in." footer={footer}>
        <p className="text-sm leading-6 text-slate-600">
          We sent a confirmation link to <strong className="font-medium text-ink">{email}</strong>. Open it, then sign in.
        </p>
        <p className="mt-2 text-xs text-slate-500">If the administrator disabled email confirmation in Supabase, you can sign in right away.</p>
        <Link className="btn btn-primary mt-5 w-full" to="/login" state={{ from: redirectTo }}>Go to sign in</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Progress, flags and leaderboard rank sync to your account." footer={footer}>
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5" noValidate>
        <div>
          <label className="label" htmlFor="signup-name">Full name <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            id="signup-name" type="text" autoComplete="name" className="input" value={fullName}
            onChange={(event) => setFullName(event.target.value)} placeholder="Ada Lovelace" maxLength={120}
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email" type="email" autoComplete="email" inputMode="email" required className="input"
            value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={200}
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-password">Password</label>
          <input
            id="signup-password" type="password" autoComplete="new-password" required className="input"
            value={password} onChange={(event) => setPassword(event.target.value)}
            placeholder={`At least ${MIN_PASSWORD} characters`} maxLength={200} minLength={MIN_PASSWORD}
          />
        </div>
        <div>
          <label className="label" htmlFor="signup-confirm">Confirm password</label>
          <input
            id="signup-confirm" type="password" autoComplete="new-password" required className="input"
            value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat the password" maxLength={200}
          />
        </div>
        <p className="text-xs leading-5 text-slate-500">
          By creating an account you agree to use the techniques taught here only on systems you own or are authorised to test.
        </p>
        <button className="btn btn-primary w-full" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              Creating account…
            </>
          ) : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
