import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalFetch = globalThis.fetch

async function loadApi() {
  vi.resetModules()
  return import('../services/api.js')
}

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function setCookie(name, value) {
  document.cookie = `${name}=${value}; path=/`
}

const STUDENT = { id: 'user-1', email: 'student@example.com', role: 'student' }

describe('api transport', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it('sends cookie credentials and never a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await expect(api.modules()).resolves.toEqual([])

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/modules')
    expect(options.credentials).toBe('include')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('attaches the readable CSRF cookie to state-changing requests', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ correct: false }))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await api.flag('llm01', 'FLAG{nope}')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
    expect(options.headers['X-CSRF-Token']).toBe('csrf-token-123')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('fetches a CSRF token first when the readable cookie is missing', async () => {
    const fetchMock = vi.fn(async (url) => (
      url === '/api/auth/csrf'
        ? jsonResponse({ csrf_token: 'fresh-token' })
        : jsonResponse({ correct: false })
    ))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await api.flag('llm01', 'FLAG{nope}')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/csrf', '/api/modules/llm01/flag'])
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('fresh-token')
  })

  it('does not attach CSRF to login, registration or refresh', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user: STUDENT }))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await api.login('student@example.com', 'correct-horse')
    await api.register({ email: 'new@example.com', password: 'correct-horse', fullName: 'Ada' })
    await api.refresh()

    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers['X-CSRF-Token']).toBeUndefined()
    }
  })

  it('retries a retry-safe GET after a network failure, then succeeds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse([{ id: 'llm01' }]))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    const pending = api.modules()
    await vi.advanceTimersByTimeAsync(2000)

    await expect(pending).resolves.toEqual([{ id: 'llm01' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a cold-start timeout as a timeout error, not a generic failure', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))

    const { api } = await loadApi()
    const pending = api.modules()
    pending.catch(() => {})
    // First attempt (120s) plus two GET retries (60s each) and their backoff.
    await vi.advanceTimersByTimeAsync(250000)

    await expect(pending).rejects.toMatchObject({ kind: 'timeout', status: 0 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('never retries a state-changing POST', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const { api } = await loadApi()
    await expect(api.flag('llm01', 'FLAG{x}')).rejects.toMatchObject({ kind: 'network' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight request for duplicate POST submissions', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    let release
    globalThis.fetch = vi.fn(() => new Promise((resolve) => {
      release = () => resolve(jsonResponse({ correct: false }))
    }))

    const { api } = await loadApi()
    const first = api.flag('llm01', 'FLAG{x}')
    const second = api.flag('llm01', 'FLAG{x}')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    release()
    await expect(first).resolves.toEqual({ correct: false })
    await expect(second).resolves.toEqual({ correct: false })
  })

  it('classifies a 502/503/504 response as backend unavailable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: 'upstream waking' }, 503))

    const { api } = await loadApi()
    await expect(api.health()).rejects.toMatchObject({ kind: 'unavailable', status: 503 })
  })

  it('refreshes an expired access token once and retries the original GET', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: STUDENT }))
      .mockResolvedValueOnce(jsonResponse({ modules: {} }))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await expect(api.progress()).resolves.toEqual({ modules: {} })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/progress',
      '/api/auth/refresh',
      '/api/progress',
    ])
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })

  it('does not loop when the retried state-changing request is still unauthorized', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    const onUnauthorized = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: STUDENT }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
    globalThis.fetch = fetchMock

    const { api, setUnauthorizedHandler } = await loadApi()
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.flag('llm01', 'FLAG{x}')).rejects.toMatchObject({ kind: 'auth', status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('clears the local session and rejects when refresh is refused', async () => {
    const onUnauthorized = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: 'revoked' }, 401))
    globalThis.fetch = fetchMock

    const { api, setUnauthorizedHandler } = await loadApi()
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.progress()).rejects.toMatchObject({ kind: 'auth', status: 401 })
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('uploads Markdown as multipart form data with the CSRF header', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'course-1', status: 'draft' }))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    const file = new File(['---\ntitle: Test\n---\n\n## One\nBody'], 'course.md', { type: 'text/markdown' })
    await api.uploadCourse(file, 'draft')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/courses')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('status')).toBe('draft')
    expect(options.body.get('file').name).toBe('course.md')
    expect(options.headers['Content-Type']).toBeUndefined()
    expect(options.headers['X-CSRF-Token']).toBe('csrf-token-123')
  })

  it('saves an in-place course edit as JSON with the CSRF header', async () => {
    setCookie('llm_csrf', 'csrf-token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'course-1', status: 'draft' }))
    globalThis.fetch = fetchMock

    const { api } = await loadApi()
    await api.updateCourseSource('course-1', '---\ntitle: Test\n---\n\n## One\nBody')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/courses/course-1/source')
    expect(options.method).toBe('PUT')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['X-CSRF-Token']).toBe('csrf-token-123')
    expect(JSON.parse(options.body).source).toContain('title: Test')
  })
})
