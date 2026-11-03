import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAuthEnabled } from '../services/supabase.js'
import AuthShell from '../components/AuthShell.jsx'

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

  const footer = <>New here? <Link className="text-neon underline decoration-dotted" to="/signup">Create an account</Link> · <Link className="text-fog-400 underline decoration-dotted" to="/">Back to home</Link></>

  if (!isAuthEnabled()) {
    return (
      <AuthShell title="Sign in" subtitle="This deployment has no account system attached, so the lab is open." footer={footer}>
        <p className="text-sm text-fog-300">Authentication is not configured here — every lab runs in local mode and progress stays in this browser.</p>
        <Link className="btn btn-primary mt-4 w-full" to="/">Continue in local mode</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Sign in" subtitle="Pick up where you left off — flags, fixes and rank are saved to your account." footer={footer}>
      <form onSubmit={submit} className="space-y-4" noValidate>
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
    </AuthShell>
  )
}
