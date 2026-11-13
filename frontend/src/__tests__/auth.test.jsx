import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { AuthProvider } from '../hooks/useAuth.jsx'
import { ProgressProvider } from '../hooks/useProgress.jsx'
import Login from '../pages/Login.jsx'
import Signup from '../pages/Signup.jsx'

const api = vi.hoisted(() => ({
  authConfig: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  modules: vi.fn(),
  progress: vi.fn(),
  stats: vi.fn(),
}))

vi.mock('../services/api.js', () => ({
  api,
  setUnauthorizedHandler: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

const MODULE = {
  id: 'llm01', name: 'Prompt Injection', category: 'LLM01:2025 Prompt Injection', owasp_id: 'LLM01',
  difficulty: 'Beginner', estimated_minutes: 20, prerequisites: ['HTTP'], overview: 'Overview text',
  challenge: 'Capture the flag', objectives: ['Obj A'],
}

const STUDENT = { id: 'user-1', email: 'student@example.com', full_name: '', role: 'student', created_at: '2026-01-01T00:00:00Z' }
const ADMIN = { ...STUDENT, id: 'admin-1', email: 'admin@example.com', role: 'admin' }

beforeEach(() => {
  vi.resetAllMocks()
  api.authConfig.mockResolvedValue({ enabled: true, registration: true, mode: 'local' })
  api.me.mockResolvedValue({ user: null })
  api.login.mockResolvedValue({ user: STUDENT })
  api.register.mockResolvedValue({ user: null, needs_confirmation: true })
  api.logout.mockResolvedValue({ ok: true })
  api.modules.mockResolvedValue([MODULE])
  api.progress.mockResolvedValue({ modules: {}, courses: {} })
  api.stats.mockResolvedValue({ labs: 1, minutes: 20, owasp_categories: 1, difficulty: { Beginner: 1 } })
})

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

function renderAuthPage(Page, path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={path} element={<Page />} />
          <Route path="/" element={<p>Signed in destination</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('route guards', () => {
  it('redirects signed-out visitors to the login page', async () => {
    renderApp('/labs')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('restores a cookie session from /auth/me without browser tokens', async () => {
    api.me.mockResolvedValue({ user: STUDENT })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect((await screen.findAllByText('student@example.com')).length).toBeGreaterThan(0)
    // Only cosmetic preferences (sidebar state) may be persisted. No token,
    // session or progress data is ever written to browser storage.
    const keys = Object.keys(localStorage)
    expect(keys.filter((key) => /token|session|auth|progress|supabase/i.test(key))).toEqual([])
  })

  it('shows the admin console entry only to administrators', async () => {
    api.me.mockResolvedValue({ user: STUDENT })
    const { unmount } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin console' })).not.toBeInTheDocument()
    unmount()

    api.me.mockResolvedValue({ user: ADMIN })
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Admin console' })).toBeInTheDocument()
  })

  it('revokes the server session on sign out and returns to the signed-out UI', async () => {
    api.me.mockResolvedValue({ user: STUDENT })
    const user = userEvent.setup()
    renderApp('/')

    await screen.findByRole('heading', { name: 'Dashboard' })
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1))
    expect((await screen.findAllByRole('link', { name: 'Sign in' })).length).toBeGreaterThan(0)
  })
})

describe('login page', () => {
  it('validates the form before calling the API', async () => {
    const user = userEvent.setup()
    renderAuthPage(Login, '/login')

    await screen.findByLabelText('Email')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(api.login).not.toHaveBeenCalled()
  })

  it('signs in through the auth endpoint and navigates to the destination', async () => {
    const user = userEvent.setup()
    renderAuthPage(Login, '/login')

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText('Email'), ' student@example.com ')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Signed in destination')).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith('student@example.com', 'correct-horse')
  })

  it('surfaces backend authentication errors', async () => {
    api.login.mockRejectedValue(new Error('Invalid email or password.'))
    const user = userEvent.setup()
    renderAuthPage(Login, '/login')

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText('Email'), 'student@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
  })
})

describe('signup page', () => {
  it('enforces the password rules before calling the API', async () => {
    const user = userEvent.setup()
    renderAuthPage(Signup, '/signup')

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')
    expect(api.register).not.toHaveBeenCalled()
  })

  it('registers with the display name and asks for email confirmation', async () => {
    const user = userEvent.setup()
    renderAuthPage(Signup, '/signup')

    await screen.findByLabelText('Email')
    await user.type(screen.getByLabelText(/^Full name/), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'correct-horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(api.register).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'correct-horse',
      fullName: 'Ada Lovelace',
    })
  })
})

describe('open mode', () => {
  it('keeps the platform usable when authentication is not configured', async () => {
    api.authConfig.mockResolvedValue({ enabled: false, registration: false, mode: 'open' })
    renderAuthPage(Login, '/login')

    expect(await screen.findByRole('link', { name: 'Continue without an account' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(api.me).not.toHaveBeenCalled()
  })
})
