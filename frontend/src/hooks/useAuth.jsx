import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isAuthEnabled, supabase } from '../services/supabase.js'
import { setAuthToken } from '../services/api.js'

const LOCAL = { enabled: false, session: null, profile: null, loading: false }
const Ctx = createContext(null)

// Holds the signed-in Supabase session and the user's profile row (role, name).
// Without Supabase configuration it degrades to local mode: no session,
// loading = false, everything works anonymously.
export function AuthProvider({ children }) {
  const enabled = isAuthEnabled()
  const [state, setState] = useState({ enabled, session: null, profile: null, loading: enabled })

  useEffect(() => {
    if (!enabled) {
      setState({ enabled: false, session: null, profile: null, loading: false })
      return undefined
    }
    const sb = supabase()
    let live = true
    let currentUserId = null

    async function apply(session) {
      if (!live) return
      setAuthToken(session ? session.access_token : null)
      if (!session) {
        currentUserId = null
        setState({ enabled: true, session: null, profile: null, loading: false })
        return
      }
      const switching = session.user.id !== currentUserId
      currentUserId = session.user.id
      setState((s) => ({ enabled: true, session, profile: switching ? null : s.profile, loading: switching ? true : s.loading }))
      const { data, error } = await sb.from('profiles').select('id,email,full_name,role,created_at').eq('id', session.user.id).maybeSingle()
      if (!live) return
      // Only apply the result if the session has not changed in the meantime.
      setState((s) => (s.session && s.session.user.id === session.user.id ? { ...s, profile: error ? null : data, loading: false } : s))
    }

    sb.auth.getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null))
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { apply(session) })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [enabled])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }, [])

  const signUp = useCallback(async ({ fullName, email, password }) => {
    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(error.message)
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    try { await supabase().auth.signOut() } catch { /* offline: local state still clears */ }
    setAuthToken(null)
    setState({ enabled: true, session: null, profile: null, loading: false })
  }, [])

  const refreshProfile = useCallback(async () => {
    const sb = supabase()
    if (!sb) return
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const { data } = await sb.from('profiles').select('id,email,full_name,role,created_at').eq('id', session.user.id).maybeSingle()
    if (data) setState((s) => (s.session ? { ...s, profile: data } : s))
  }, [])

  const value = useMemo(
    () => ({ ...state, signIn, signUp, signOut, refreshProfile }),
    [state, signIn, signUp, signOut, refreshProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// Tolerates being used without an AuthProvider (local mode, unit tests).
export function useAuth() {
  const v = useContext(Ctx)
  return v || LOCAL
}
