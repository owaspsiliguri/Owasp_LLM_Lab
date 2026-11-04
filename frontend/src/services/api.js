const BASE = import.meta.env.VITE_API_BASE || '/api'
const DEFAULT_TIMEOUT = 20000

let authToken = null
let unauthorizedHandler = null

export function setAuthToken(token) {
  authToken = token
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

function errorMessage(body, status) {
  const detail = body && (body.detail ?? body.message)
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join('; ')
  return `Request failed (${status})`
}

async function request(path, { timeout = DEFAULT_TIMEOUT, ...options } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  try {
    const response = await fetch(`${BASE}${path}`, { ...options, headers, signal: controller.signal })
    let body = null
    try { body = await response.json() } catch { /* empty or non-JSON response */ }

    if (!response.ok) {
      if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
      const error = new Error(errorMessage(body, response.status))
      error.status = response.status
      error.code = body?.status
      error.body = body
      throw error
    }
    return body
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The request took too long. Try again.')
      timeoutError.status = 0
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const post = (path, payload, timeout) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  ...(timeout ? { timeout } : {}),
})

export const api = {
  health: () => request('/health'),
  stats: () => request('/stats'),
  modules: () => request('/modules'),
  module: (id) => request(`/modules/${encodeURIComponent(id)}`),
  hint: (id, n) => request(`/modules/${encodeURIComponent(id)}/hints/${n}`),
  run: (id, side, payload) => post(`/modules/${encodeURIComponent(id)}/${side}`, payload, 45000),
  flag: (id, flag) => post(`/modules/${encodeURIComponent(id)}/flag`, { flag }),
  validateFix: (id, code) => post(`/modules/${encodeURIComponent(id)}/fixit/validate`, { code }, 45000),
  leaderboard: () => request('/leaderboard'),
}
