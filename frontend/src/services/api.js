// Browser transport for the platform API.
//
// The backend owns authentication: access and refresh tokens live in HttpOnly
// cookies, so this module never stores a token. State-changing requests carry
// the readable CSRF cookie in `X-CSRF-Token` (double submit), and an expired
// access token is refreshed once before the original request is retried.
//
// Local development is same-origin: Vite proxies `/api` to the backend. A
// split-origin deployment must be served through the same site (proxy or
// same-origin domain) for the cookies to be sent at all.

const COLD_START_TIMEOUT = 120000
const RETRY_TIMEOUT = 60000
const RETRY_DELAYS = [1500, 3000]
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_EXEMPT = new Set([
  '/auth/login', '/auth/register', '/auth/refresh', '/auth/csrf', '/auth/password-reset',
])
const NO_REFRESH = new Set([
  '/auth/login', '/auth/register', '/auth/refresh', '/auth/csrf', '/auth/password-reset',
])
const CSRF_COOKIE = 'llm_csrf'

const normaliseBase = (value) => String(value || '').trim().replace(/\/+$/, '')

function resolveBase() {
  const configured = normaliseBase(import.meta.env.VITE_API_BASE)
  // Always same-origin by default. A production build that points at a
  // different site cannot use cookie authentication unless that site proxies
  // the API, so guessing a deployed URL would silently break sign-in.
  return configured || '/api'
}

export const API_BASE = resolveBase()

let unauthorizedHandler = null
let refreshPromise = null
const inflightPosts = new Map()

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export class ApiError extends Error {
  constructor(message, { kind = 'http', status = 0, code = null, body = null, retryable = false, attempts = 1, mayHaveCompleted = false, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.body = body
    this.retryable = retryable
    this.attempts = attempts
    this.mayHaveCompleted = mayHaveCompleted
    if (cause) this.cause = cause
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return ''
  const prefix = `${name}=`
  const row = String(document.cookie || '').split('; ').find((item) => item.startsWith(prefix))
  if (!row) return ''
  try { return decodeURIComponent(row.slice(prefix.length)) } catch { return row.slice(prefix.length) }
}

function csrfFromCookie() {
  return readCookie(CSRF_COOKIE)
}

async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return ''
  const body = await response.json().catch(() => null)
  return String(body?.csrf_token || csrfFromCookie())
}

function errorMessage(body, status) {
  const detail = body && (body.detail ?? body.message)
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join('; ')
  if (status === 502 || status === 503 || status === 504) {
    return 'The backend is starting up or temporarily unavailable. Try again in a moment.'
  }
  if (status >= 500) return `The backend failed to handle the request (${status}).`
  return `Request failed (${status})`
}

function classifyHttpError(status, body) {
  const code = String(body?.code || '')
  const detail = String(body?.detail || body?.message || '')
  if (code === 'database_unavailable' || (status === 503 && /database|supabase|postgres/i.test(detail))) {
    return 'database'
  }
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 502 || status === 503 || status === 504) return 'unavailable'
  return 'http'
}

function timeoutError(timeout, method) {
  const seconds = Math.round(timeout / 1000)
  if (method === 'GET') {
    return new ApiError(
      `The backend did not respond within ${seconds} seconds. A sleeping instance can take up to a minute to wake; try again.`,
      { kind: 'timeout', status: 0, retryable: true },
    )
  }
  // State-changing requests are never retried automatically: the server may
  // already have applied the change even though the response was lost.
  return new ApiError(
    `The request timed out after ${seconds} seconds. It may still have been processed, so check the result before submitting again.`,
    { kind: 'timeout', status: 0, retryable: false, mayHaveCompleted: true },
  )
}

function networkError(cause) {
  return new ApiError('The request could not be sent. Check your internet connection and try again.', {
    kind: 'network',
    status: 0,
    retryable: true,
    cause,
  })
}

function canRetry(error) {
  if (!(error instanceof ApiError)) return false
  if (error.kind === 'network' || error.kind === 'timeout') return true
  return error.status === 429 || (error.kind === 'unavailable' && RETRYABLE_STATUS.has(error.status))
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

function backoffDelay(attempt) {
  const base = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)]
  // Jitter avoids every client reconnecting in lockstep after an outage.
  return base + Math.round(base * 0.2 * Math.random())
}

/** Rotate the session once. Returns the signed-in user, or null when revoked. */
export async function refreshSession() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) unauthorizedHandler?.()
        return null
      }
      return body?.user || null
    } catch {
      // A network outage is not proof that the session ended; keep the local
      // state so the next request can try again.
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function attemptRequest(path, options) {
  const { method, timeout, skipAuthRefresh = false, skipCsrf = false, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const headers = { Accept: 'application/json', ...(rest.headers || {}) }

  if (!SAFE_METHODS.has(method) && !skipCsrf && !CSRF_EXEMPT.has(path)) {
    const token = csrfFromCookie() || await fetchCsrfToken()
    if (token) headers['X-CSRF-Token'] = token
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      method,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
    let body = null
    try { body = await response.json() } catch { /* empty or non-JSON response */ }

    if (response.status === 401 && !skipAuthRefresh && !NO_REFRESH.has(path)) {
      const user = await refreshSession()
      if (user) return await attemptRequest(path, { ...options, skipAuthRefresh: true })
    }

    if (!response.ok) {
      if (response.status === 401) unauthorizedHandler?.()
      const kind = classifyHttpError(response.status, body)
      throw new ApiError(errorMessage(body, response.status), {
        kind,
        status: response.status,
        code: body?.code ?? body?.status ?? null,
        body,
        retryable: method === 'GET' && RETRYABLE_STATUS.has(response.status),
      })
    }
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error?.name === 'AbortError') throw timeoutError(timeout, method)
    throw networkError(error)
  } finally {
    clearTimeout(timer)
  }
}

async function perform(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const retry = options.retry ?? method === 'GET'
  const maxAttempts = retry ? RETRY_DELAYS.length + 1 : 1
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // The first attempt gets the full cold-start allowance. A retry happens
    // after a failed/slow first attempt, when the instance is normally awake.
    const timeout = options.timeout ?? (attempt === 1 ? COLD_START_TIMEOUT : RETRY_TIMEOUT)
    try {
      return await attemptRequest(path, { ...options, method, timeout })
    } catch (error) {
      lastError = error
      if (error instanceof ApiError) error.attempts = attempt
      const mayRetry = retry && attempt < maxAttempts && canRetry(error)
      if (!mayRetry) throw error
      await sleep(backoffDelay(attempt))
    }
  }
  throw lastError
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  // A duplicate state-changing request (double click, repeated submit) shares
  // the in-flight promise instead of being sent twice. GETs are naturally safe
  // to repeat and are not deduplicated so a reload can trigger a fresh read.
  const key = method === 'GET' ? null : `${method} ${path} ${typeof options.body === 'string' ? options.body : ''}`
  if (key && inflightPosts.has(key)) return inflightPosts.get(key)

  const promise = perform(path, options)
  if (key) {
    inflightPosts.set(key, promise)
    promise.then(() => inflightPosts.delete(key), () => inflightPosts.delete(key))
  }
  return promise
}

const post = (path, payload, options = {}) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  ...options,
})

const putForm = (path, form) => request(path, {
  method: 'PUT',
  body: form,
})

const postForm = (path, form) => request(path, {
  method: 'POST',
  body: form,
})

const patch = (path, payload) => request(path, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

export const api = {
  health: () => request('/health', { retry: false }),
  stats: () => request('/stats'),
  modules: () => request('/modules'),
  module: (id) => request(`/modules/${encodeURIComponent(id)}`),
  hint: (id, n) => request(`/modules/${encodeURIComponent(id)}/hints/${n}`),
  run: (id, side, payload) => post(`/modules/${encodeURIComponent(id)}/${side}`, payload),
  flag: (id, flag) => post(`/modules/${encodeURIComponent(id)}/flag`, { flag }),
  validateFix: (id, code) => post(`/modules/${encodeURIComponent(id)}/fixit/validate`, { code }),
  leaderboard: () => request('/leaderboard'),

  authConfig: () => request('/auth/config', { retry: false }),
  csrf: () => request('/auth/csrf', { retry: false }),
  login: (email, password) => post('/auth/login', { email, password }),
  register: ({ email, password, fullName }) => post('/auth/register', {
    email,
    password,
    ...(fullName ? { full_name: fullName } : {}),
  }),
  refresh: () => refreshSession(),
  logout: () => post('/auth/logout', {}),
  me: () => request('/auth/me', { retry: false }),
  updateProfile: (fullName) => request('/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName }),
  }),
  changePassword: (currentPassword, newPassword) => post('/auth/password', {
    current_password: currentPassword,
    new_password: newPassword,
  }),
  requestPasswordReset: (email) => post('/auth/password-reset', { email }),

  progress: () => request('/progress'),
  resetProgress: () => post('/progress/reset', {}),

  courses: () => request('/courses'),
  course: (slug) => request(`/courses/${encodeURIComponent(slug)}`),
  completeCourse: (slug, completed = true) => post(`/courses/${encodeURIComponent(slug)}/complete`, { completed }),

  adminOverview: () => request('/admin/overview'),
  adminCourses: () => request('/admin/courses'),
  adminCourse: (id) => request(`/admin/courses/${encodeURIComponent(id)}`),
  uploadCourse: (file, status = 'draft') => {
    const form = new FormData()
    form.append('file', file)
    form.append('status', status)
    return postForm('/admin/courses', form)
  },
  replaceCourse: (id, file) => putForm(`/admin/courses/${encodeURIComponent(id)}`, (() => {
    const form = new FormData()
    form.append('file', file)
    return form
  })()),
  updateCourseSource: (id, source) => request(`/admin/courses/${encodeURIComponent(id)}/source`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  }),
  setCourseStatus: (id, status) => patch(`/admin/courses/${encodeURIComponent(id)}`, { status }),
  deleteCourse: (id) => request(`/admin/courses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
