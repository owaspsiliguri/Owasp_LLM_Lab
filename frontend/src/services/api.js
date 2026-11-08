// Render's free web instances sleep after inactivity and can take a minute or
// more to wake. Every request therefore allows a cold-start window instead of
// aborting at the old 20-second default, which is what produced the
// "request took too long" error before the backend had even finished booting.
const COLD_START_TIMEOUT = 120000
const RETRY_TIMEOUT = 60000
const RETRY_DELAYS = [1500, 3000]
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const DEPLOYED_API_BASE = 'https://owasp-llm-lab-api.onrender.com/api'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
const SERVICE_HOSTNAMES = new Set(['backend', 'api', 'chromadb', 'frontend'])

const normaliseBase = (value) => String(value || '').trim().replace(/\/+$/, '')

function unusableBase(base) {
  try {
    const parsed = new URL(base, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    const host = parsed.hostname.toLowerCase()
    // Docker service names only resolve inside the compose network; a browser
    // can never use them. A production build must not point at localhost.
    if (SERVICE_HOSTNAMES.has(host)) return true
    if (import.meta.env.PROD && LOCAL_HOSTNAMES.has(host)) return true
    return false
  } catch {
    return true
  }
}

function resolveBase() {
  const configured = normaliseBase(import.meta.env.VITE_API_BASE)
  if (configured && !unusableBase(configured)) return configured

  const hostname = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase()
  const local = LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')

  // Vercel, Render static sites and any other remote deployment call the
  // deployed API directly unless the build explicitly configured another URL.
  if (!local && import.meta.env.PROD) return DEPLOYED_API_BASE

  // Local Docker (and `vite dev`) proxy /api to the backend.
  return '/api'
}

export const API_BASE = resolveBase()

let authToken = null
let unauthorizedHandler = null
const inflightPosts = new Map()

export function setAuthToken(token) {
  authToken = token
}

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
  if (status === 502 || status === 503 || status === 504) return 'unavailable'
  return 'http'
}

function timeoutError(timeout, method) {
  const seconds = Math.round(timeout / 1000)
  if (method === 'GET') {
    return new ApiError(
      `The backend did not respond within ${seconds} seconds. A sleeping Render instance can take up to a minute to wake; try again.`,
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

async function attemptRequest(path, { method, timeout, ...options }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, signal: controller.signal })
    let body = null
    try { body = await response.json() } catch { /* empty or non-JSON response */ }

    if (!response.ok) {
      if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
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
  const key = method === 'GET' ? null : `${method} ${path} ${options.body ?? ''}`
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
}
