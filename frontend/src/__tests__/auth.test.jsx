import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { AuthProvider } from '../hooks/useAuth.jsx'
import { ProgressProvider } from '../hooks/useProgress.jsx'
import Login from '../pages/Login.jsx'
import Signup from '../pages/Signup.jsx'

const mocks = vi.hoisted(() => ({
  isAuthEnabled: vi.fn(() => true),
  supabase: vi.fn(),
}))

vi.mock('../services/supabase.js', () => ({
  isAuthEnabled: mocks.isAuthEnabled,
  supabase: mocks.supabase,
}))

// Minimal PostgREST-style thenable chain: select().eq()… resolves to nothing
// interesting, maybeSingle() returns the profile.
function chain(profile) {
  const b = {}
  const result = { data: [], error: null }
  b.select = () => b
  b.eq = () => b
  b.order = () => b
  b.limit = () => b
  b.delete = () => b
  b.upsert = () => Promise.resolve({ error: null })
  b.maybeSingle = () => Promise.resolve({ data: profile, error: null })
  b.then = (onF, onR) => Promise.resolve(result).then(onF, onR)
  return b
}

function makeClient({ session = null, profile = null, signInError = null } = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(async () => (signInError ? { error: { message: signInError } } : { error: null, data: { session } })),
      signUp: vi.fn(async () => ({ error: null, data: { session: null, user: {} } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => chain(profile)),
  }
}

const session = { access_token: 'token', user: { id: 'user-1', email: 'student@example.com' } }

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ProgressProvider>
          <App />
        </ProgressProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.isAuthEnabled.mockReturnValue(true)
  mocks.supabase.mockReset()
})

describe('route guards', () => {
  it('redirects signed-out visitors to the login page', async () => {
    mocks.supabase.mockReturnValue(makeClient({ session: null }))
    renderApp('/labs')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('lets signed-in students through and shows their identity', async () => {
    mocks.supabase.mockReturnValue(makeClient({ session, profile: { id: 'user-1', email: 'student@example.com', role: 'student' } }))
    renderApp('/')
    expect(await screen.findByText('student@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows the Admin nav entry only for administrators', async () => {
    mocks.supabase.mockReturnValue(makeClient({ session, profile: { id: 'user-1', email: 'student@example.com', role: 'admin' } }))
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

})

describe('login page', () => {
  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<p>Welcome back</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('validates the form before calling Supabase', async () => {
    const client = makeClient()
    mocks.supabase.mockReturnValue(client)
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in and navigates to the requested page', async () => {
    const client = makeClient({ session: null }) // no session until signInWithPassword succeeds
    mocks.supabase.mockReturnValue(client)
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'student@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'student@example.com', password: 'correct-horse' })
  })

  it('surfaces Supabase authentication errors', async () => {
    mocks.supabase.mockReturnValue(makeClient({ signInError: 'Invalid login credentials' }))
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'student@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
  })
})

describe('signup page', () => {
  function renderSignup() {
    return render(
      <MemoryRouter initialEntries={['/signup']}>
        <AuthProvider>
          <Routes>
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<p>Dashboard</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('enforces password rules and confirmation', async () => {
    const client = makeClient()
    mocks.supabase.mockReturnValue(client)
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('creates the account with the display name and asks for email confirmation', async () => {
    const client = makeClient()
    mocks.supabase.mockReturnValue(client)
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByLabelText('Full name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'correct-horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'correct-horse',
      options: { data: { full_name: 'Ada Lovelace' } },
    })
  })
})

describe('local mode fallback', () => {
  it('keeps the app open when Supabase is not configured', async () => {
    mocks.isAuthEnabled.mockReturnValue(false)
    mocks.supabase.mockReturnValue(null)
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<p>Local dashboard</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Continue in local mode' })).toBeInTheDocument()
  })
})

describe('token plumbing', () => {
  it('attaches the bearer token to lab API calls after sign-in', async () => {
    const client = makeClient({ session, profile: { id: 'user-1', email: 'student@example.com', role: 'student' } })
    mocks.supabase.mockReturnValue(client)
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    globalThis.fetch = fetchSpy
    const { api } = await import('../services/api.js')
    const { setAuthToken } = await import('../services/api.js')
    setAuthToken('abc123')
    await api.health()
    expect(fetchSpy).toHaveBeenCalledWith('/api/health', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer abc123' }) }))
    setAuthToken(null)
    await api.health()
    expect(fetchSpy.mock.calls.at(-1)[1].headers.Authorization).toBeUndefined()
  })
})
