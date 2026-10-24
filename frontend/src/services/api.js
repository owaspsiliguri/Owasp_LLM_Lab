// Lab API client. `VITE_API_BASE` points at the deployed FastAPI backend
// (e.g. https://my-app.onrender.com/api); the default `/api` works for Docker
// and local dev, where a proxy forwards /api to the backend.
const BASE = import.meta.env.VITE_API_BASE || '/api'

let authToken = null

// Set by the auth provider whenever the Supabase session changes.
export function setAuthToken(token) {
  authToken = token
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  let body = null
  try { body = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const detail = body && body.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : `Request failed (${res.status})`
    const error = new Error(message)
    error.status = res.status
    throw error
  }
  return body
}

const post = (path, payload) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

export const api = {
  health: () => request('/health'),
  modules: () => request('/modules'),
  module: (id, mode = 'beginner') => request(`/modules/${encodeURIComponent(id)}?mode=${encodeURIComponent(mode)}`),
  hint: (id, n, mode = 'beginner') => request(`/modules/${encodeURIComponent(id)}/hints/${n}?mode=${encodeURIComponent(mode)}`),
  run: (id, side, payload) => post(`/modules/${encodeURIComponent(id)}/${side}`, payload),
  flag: (id, flag, mode = 'beginner') => post(`/modules/${encodeURIComponent(id)}/flag`, { flag, mode }),
  validateFix: (id, code) => post(`/modules/${encodeURIComponent(id)}/fixit/validate`, { code }),
  leaderboard: () => request('/leaderboard'),
}
