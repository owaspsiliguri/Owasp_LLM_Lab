import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalFetch = globalThis.fetch

async function loadApi() {
  vi.resetModules()
  return import('../services/api.js')
}

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

describe('api client resilience', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
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
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const { api } = await loadApi()
    await expect(api.flag('llm01', 'FLAG{x}')).rejects.toMatchObject({ kind: 'network' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight request for duplicate POST submissions', async () => {
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
})
