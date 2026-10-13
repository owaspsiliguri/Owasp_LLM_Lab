import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import { supabase } from '../services/supabase.js'

const KEY = 'lll.progress.v1'
const EMPTY = { mode: 'beginner', modules: {} }
export const MODES = ['beginner', 'intermediate', 'advanced']

// Progress is stored per identity: anonymous browsers use the classic key,
// signed-in users get their own key so accounts never leak into each other.
const keyFor = (userId) => (userId ? `${KEY}.${userId}` : KEY)

function loadKey(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    if (data && MODES.includes(data.mode) && typeof data.modules === 'object') return data
  } catch { /* corrupt or missing storage */ }
  return EMPTY
}

const load = () => loadKey(KEY)

const Ctx = createContext(null)

export function ProgressProvider({ children }) {
  const { session, loading: authLoading } = useAuth()
  const userId = session && session.user ? session.user.id : null
  const [state, setState] = useState(load)

  // Identity changed: switch to that identity's stored progress, then merge
  // whatever is saved server-side (OR semantics: once true, it stays true).
  // Declared before the persist effect so this read happens before any write.
  useEffect(() => {
    if (authLoading) return undefined
    setState(loadKey(keyFor(userId)))
    if (!userId) return undefined
    let live = true
    supabase().from('progress').select('module_id,explored,flag,fixit').eq('user_id', userId)
      .then(({ data, error }) => {
        if (!live || error || !data || !data.length) return
        setState((s) => {
          const modules = { ...s.modules }
          for (const row of data) {
            const cur = modules[row.module_id] || {}
            modules[row.module_id] = {
              explored: Boolean(cur.explored || row.explored),
              flag: Boolean(cur.flag || row.flag),
              fixit: Boolean(cur.fixit || row.fixit),
            }
          }
          return { ...s, modules }
        })
      })
      .catch(() => { /* offline: local copy stays authoritative */ })
    return () => { live = false }
  }, [userId, authLoading])

  useEffect(() => {
    if (authLoading) return
    try { localStorage.setItem(keyFor(userId), JSON.stringify(state)) } catch { /* storage unavailable */ }
  }, [state, userId, authLoading])

  const setMode = useCallback((mode) => MODES.includes(mode) && setState((s) => ({ ...s, mode })), [])

  const mark = useCallback((id, field) => {
    setState((s) => {
      const cur = s.modules[id] || {}
      return cur[field] ? s : { ...s, modules: { ...s.modules, [id]: { ...cur, [field]: true } } }
    })
    if (userId) {
      supabase().from('progress')
        .upsert({ user_id: userId, module_id: id, [field]: true, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn('Progress sync failed:', error.message) })
        .catch(() => { /* offline: local copy stays authoritative */ })
    }
  }, [userId])

  const reset = useCallback(() => {
    setState(EMPTY)
    if (userId) {
      supabase().from('progress').delete().eq('user_id', userId)
        .then(() => {})
        .catch(() => { /* offline: server rows clear on next sync */ })
    }
  }, [userId])

  const value = useMemo(() => ({ ...state, setMode, mark, reset }), [state, setMode, mark, reset])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProgress() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProgress must be used inside ProgressProvider')
  return v
}

export function summarize(modules, progress) {
  const total = modules.length
  const p = (id) => progress.modules[id] || {}
  const explored = modules.filter((m) => p(m.id).explored).length
  const flags = modules.filter((m) => p(m.id).flag).length
  const fixes = modules.filter((m) => p(m.id).fixit).length
  const completed = modules.filter((m) => p(m.id).flag && p(m.id).fixit).length
  return { total, explored, flags, fixes, completed, percent: total ? Math.round(((explored + flags + fixes) / (total * 3)) * 100) : 0 }
}
