import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'

export default function Login() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const redirectTo = (location.state && location.state.from) || '/'
  if (isAuthEnabled() && !loading && session) return <Navigate to={redirectTo} replace />

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) { setError('Enter a valid email address.'); return }
    if (!password) { setError('Enter your password.'); return }
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (!isAuthEnabled()) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6 text-center">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-3 text-fog-300">Authentication is not configured on this deployment, so the lab runs in local mode.</p>
          <Link className="btn btn-primary mt-4" to="/">Continue in local mode</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-fog-300">Track your lab progress, flags and Fix-It results across devices.</p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <label className="block text-sm text-fog-300">
            Email
            <input aria-label="Email" type="email" autoComplete="email" className="input mt-1" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={200} required />
          </label>
          <label className="block text-sm text-fog-300">
            Password
            <input aria-label="Password" type="password" autoComplete="current-password" className="input mt-1" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Your password" maxLength={200} required />
          </label>
          {error && <p role="alert" className="rounded border border-vuln-400/50 bg-vuln-400/10 px-3 py-2 text-sm text-vuln-400">{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-fog-300">
          New here? <Link className="text-steel-400 underline" to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
