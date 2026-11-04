import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import AuthShell from '../components/AuthShell.jsx'
import Icon from '../components/Icons.jsx'

function destinationFrom(state) {
  const from = state && typeof state.from === 'string' ? state.from : '/'
  return from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export default function Login() {
  const { signIn, session, loading, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const redirectTo = destinationFrom(location.state)
  if (isAuthEnabled() && !loading && session) return <Navigate to={redirectTo} replace />

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    clearNotice()
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await signIn(address, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      New here?{' '}
      <Link className="font-medium text-brand-700 underline decoration-brand-500/50 underline-offset-2" to="/signup" state={{ from: redirectTo }}>
        Create an account
      </Link>
    </>
  )

  if (!isAuthEnabled()) {
    return (
      <AuthShell title="Sign in" subtitle="This deployment has no account system attached, so the lab is open." footer={footer}>
        <p className="text-sm leading-6 text-slate-600">
          Authentication is not configured here. Every lab runs in local mode and progress stays in this browser.
        </p>
        <Link className="btn btn-primary mt-5 w-full" to="/">Continue in local mode</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Sign in" subtitle="Pick up where you left off — flags, fixes and rank are saved to your account." footer={footer}>
      {(notice || error) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
        >
          <Icon name={error ? 'alert' : 'clock'} size={16} className="mt-0.5 shrink-0" />
          <p>{error || notice}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="login-email">Email</label>
          <input
            id="login-email" type="email" autoComplete="email" inputMode="email" required
            className="input" value={email} placeholder="you@example.com" maxLength={200}
            aria-invalid={error ? true : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="login-password">Password</label>
          <div className="relative">
            <input
              id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
              className="input pr-11" value={password} placeholder="Your password" maxLength={200}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-500 hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <Icon name={showPassword ? 'x' : 'search'} size={16} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary w-full" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              Signing in…
            </>
          ) : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-500">
        <Link className="hover:text-ink" to="/">Back to the platform</Link>
      </p>
    </AuthShell>
  )
}
