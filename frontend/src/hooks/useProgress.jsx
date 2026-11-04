import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { supabase } from '../services/supabase.js'
import { LAB_MAX_POINTS, scoreOf } from '../services/points.js'

const KEY = 'lll.progress.v1'
const FIELDS = ['explored', 'flag', 'fixit']

// Progress is stored per identity: anonymous browsers use the classic key and
// signed-in users get their own, so two accounts on one device never mix.
const keyFor = (userId) => (userId ? `${KEY}.${userId}` : KEY)

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
  return { modules }
}

function loadKey(key) {
  try {
    return normalize(JSON.parse(localStorage.getItem(key)))
  } catch {
    return normalize(null)
  }
}

const Ctx = createContext(null)

export function ProgressProvider({ children }) {
  const { session, loading: authLoading } = useAuth()
  const userId = session?.user?.id || null
  const [state, setState] = useState(() => loadKey(keyFor(null)))

  useEffect(() => {
    if (authLoading) return undefined
    setState(loadKey(keyFor(userId)))
    if (!userId || !supabase()) return undefined
    let live = true
    supabase().from('progress').select('module_id,explored,flag,fixit,updated_at').eq('user_id', userId)
      .then(({ data, error }) => {
        if (!live || error || !data?.length) return
        setState((current) => {
          const modules = { ...current.modules }
          for (const row of data) {
            const existing = modules[row.module_id] || {}
            const at = row.updated_at && (!existing.at || row.updated_at > existing.at) ? row.updated_at : existing.at
            modules[row.module_id] = {
              explored: Boolean(existing.explored || row.explored),
              flag: Boolean(existing.flag || row.flag),
              fixit: Boolean(existing.fixit || row.fixit),
              at: at || null,
            }
          }
          return { ...current, modules }
        })
      })
      .catch(() => { /* offline: the local copy stays authoritative */ })
    return () => { live = false }
  }, [userId, authLoading])

  useEffect(() => {
    if (authLoading) return
    try { localStorage.setItem(keyFor(userId), JSON.stringify(state)) } catch { /* storage unavailable */ }
  }, [state, userId, authLoading])

  const mark = useCallback((id, field) => {
    if (!FIELDS.includes(field)) return
    const at = new Date().toISOString()
    setState((current) => {
      const existing = current.modules[id] || {}
      return {
        ...current,
        modules: { ...current.modules, [id]: { ...existing, [field]: true, at } },
      }
    })
    if (userId && supabase()) {
      supabase().from('progress')
        .upsert({ user_id: userId, module_id: id, [field]: true, updated_at: at })
        .then(({ error }) => { if (error) console.warn('Progress sync failed:', error.message) })
        .catch(() => { /* offline: local progress is unaffected */ })
    }
  }, [userId])

  const reset = useCallback(() => {
    setState(normalize(null))
    if (userId && supabase()) {
      supabase().from('progress').delete().eq('user_id', userId)
        .then(() => {})
        .catch(() => { /* server rows clear on the next successful sync */ })
    }
  }, [userId])

  const value = useMemo(() => ({ ...state, mark, reset }), [state, mark, reset])
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
  return {
    total, explored, flags, fixes, completed,
    score: scoreOf(modules, progress),
    maxScore: total * LAB_MAX_POINTS,
    percent: total ? Math.round(((explored + flags + fixes) / (total * 3)) * 100) : 0,
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
