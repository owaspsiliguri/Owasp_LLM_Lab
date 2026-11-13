import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { LAB_MAX_POINTS, scoreOf } from '../services/points.js'
import { api } from '../services/api.js'

const EMPTY = { modules: {}, courses: {} }
const Ctx = createContext(null)

function normalize(raw) {
  const modules = {}
  if (raw && typeof raw.modules === 'object' && raw.modules) {
    for (const [id, value] of Object.entries(raw.modules)) {
      if (!value || typeof value !== 'object') continue
      modules[id] = {
        explored: Boolean(value.explored),
        flag: Boolean(value.flag),
        fixit: Boolean(value.fixit),
        at: typeof value.at === 'string' ? value.at : null,
      }
    }
  }
  const courses = raw && typeof raw.courses === 'object' && raw.courses ? raw.courses : {}
  return { modules, courses }
}

/**
 * Progress is read from the API and written only by the server after it has
 * verified a run, flag or Fix-It submission. There is deliberately no
 * localStorage copy: two browsers on one account always see the same records,
 * and the browser cannot invent an achievement.
 */
export function ProgressProvider({ children }) {
  const { user, loading: authLoading, enabled } = useAuth()
  const userId = user?.id || null
  const [state, setState] = useState({ ...EMPTY, loading: true, error: null })
  const request = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++request.current
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const data = await api.progress()
      if (request.current !== ticket) return
      setState({ ...normalize(data), loading: false, error: null })
    } catch (error) {
      if (request.current !== ticket) return
      setState((current) => ({
        ...current,
        loading: false,
        error: error.kind === 'auth' || error.status === 401 ? null : error.message,
        ...(error.kind === 'auth' || error.status === 401 ? EMPTY : {}),
      }))
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (enabled && !userId) {
      setState({ ...EMPTY, loading: false, error: null })
      return
    }
    void load()
  }, [authLoading, enabled, userId, load])

  // Kept so a caller cannot forget to refresh after a server-verified action.
  const mark = useCallback(() => { void load() }, [load])

  const refresh = useCallback(() => load(), [load])

  const reset = useCallback(async () => {
    await api.resetProgress()
    setState({ ...EMPTY, loading: false, error: null })
    await load()
  }, [load])

  const value = useMemo(() => ({
    ...state,
    mark,
    refresh,
    reset,
    reload: load,
  }), [state, mark, refresh, reset, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProgress() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useProgress must be used inside ProgressProvider')
  return value
}

export function summarize(modules, progress) {
  const total = modules.length
  const entry = (id) => progress.modules[id] || {}
  const explored = modules.filter((m) => entry(m.id).explored).length
  const flags = modules.filter((m) => entry(m.id).flag).length
  const fixes = modules.filter((m) => entry(m.id).fixit).length
  const completed = modules.filter((m) => entry(m.id).flag && entry(m.id).fixit).length
  const scored = flags + fixes
  return {
    total,
    explored,
    flags,
    fixes,
    completed,
    score: scoreOf(modules, progress),
    maxScore: total * LAB_MAX_POINTS,
    // Points are only awarded for the flag and the validated fix.
    percent: total ? Math.round((scored / (total * 2)) * 100) : 0,
    completionPercent: total ? Math.round((completed / total) * 100) : 0,
  }
}

export function recentLabs(modules, progress, limit = 4) {
  const byId = new Map(modules.map((module) => [module.id, module]))
  return Object.entries(progress.modules)
    .filter(([id, entry]) => byId.has(id) && entry.at)
    .map(([id, entry]) => ({ module: byId.get(id), at: entry.at, entry }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit)
}

export function labStatus(entry = {}) {
  if (entry.flag && entry.fixit) return 'completed'
  if (entry.flag) return 'flag'
  if (entry.explored) return 'in-progress'
  return 'not-started'
}
