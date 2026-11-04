import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isAuthEnabled, supabase } from '../services/supabase.js'
import { setAuthToken, setUnauthorizedHandler } from '../services/api.js'

const LOCAL = { enabled: false, session: null, profile: null, loading: false, profileLoading: false, notice: null }
const Ctx = createContext(null)
const SESSION_CHECK_MS = 5 * 60 * 1000

async function fetchProfile(userId) {
  const sb = supabase()
  if (!sb) return null
  const { data, error } = await sb.from('profiles')
    .select('id,email,full_name,role,created_at')
    .eq('id', userId)
    .maybeSingle()
  return error ? null : data
}

export function AuthProvider({ children }) {
  const enabled = isAuthEnabled()
  const [state, setState] = useState({
    enabled, session: null, profile: null, loading: enabled, profileLoading: false, notice: null,
  })

  useEffect(() => {
    if (!enabled) {
      setAuthToken(null)
      setState({ ...LOCAL })
      return undefined
    }

    const sb = supabase()
    let live = true
    let currentUserId = null
    let profileRequest = 0
    let lastCheck = 0
    let hadSession = false

    async function applySession(session, event) {
      if (!live) return
      if (!session) {
        const notice = hadSession && event === 'SIGNED_OUT'
          ? 'Your session ended. Sign in again to continue where you left off.'
          : null
        hadSession = false
        currentUserId = null
        setAuthToken(null)
        setState({ enabled: true, session: null, profile: null, loading: false, profileLoading: false, notice })
        return
      }

      hadSession = true
      setAuthToken(session.access_token)

      if (event === 'TOKEN_REFRESHED') {
        setState((current) => ({ ...current, session, loading: false }))
        return
      }

      const switching = session.user.id !== currentUserId
      currentUserId = session.user.id
      setState((current) => ({
        ...current,
        session,
        loading: false,
        notice: null,
        profile: switching ? null : current.profile,
        profileLoading: switching || !current.profile,
      }))

      if (switching || !state.profile) {
        const request = ++profileRequest
        const profile = await fetchProfile(session.user.id)
        if (!live || request !== profileRequest) return
        setState((current) => (
          current.session?.user?.id === session.user.id
            ? { ...current, profile, profileLoading: false }
            : current
        ))
      }
    }

    sb.auth.getSession()
      .then(({ data, error }) => applySession(error ? null : data.session))
      .catch(() => applySession(null))

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      void applySession(session, event)
    })

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheck < SESSION_CHECK_MS) return
      lastCheck = now
      sb.auth.refreshSession().catch(() => { /* the auth listener handles expiry */ })
    }
    document.addEventListener('visibilitychange', onVisibility)

    setUnauthorizedHandler(async () => {
      const { data } = await sb.auth.getSession().catch(() => ({ data: { session: null } }))
      if (!data.session) await applySession(null, 'SIGNED_OUT')
    })

    return () => {
      live = false
      subscription.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      setUnauthorizedHandler(null)
    }
    // `state.profile` is intentionally read only at effect setup; session events
    // drive every later update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const adoptSession = useCallback(async (session) => {
    if (!session) return
    setAuthToken(session.access_token)
    setState((current) => ({ ...current, session, loading: false, notice: null, profileLoading: true }))
    const profile = await fetchProfile(session.user.id)
    setState((current) => (
      current.session?.user?.id === session.user.id ? { ...current, profile, profileLoading: false } : current
    ))
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    await adoptSession(data.session)
  }, [adoptSession])

  const signUp = useCallback(async ({ fullName, email, password }) => {
    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(error.message)
    if (data.session) await adoptSession(data.session)
    return { needsConfirmation: !data.session }
  }, [adoptSession])

  const signOut = useCallback(async () => {
    setAuthToken(null)
    setState({ enabled: true, session: null, profile: null, loading: false, profileLoading: false, notice: null })
    try { await supabase().auth.signOut() } catch { /* local state has already been cleared */ }
  }, [])

  const refreshProfile = useCallback(async () => {
    const sb = supabase()
    if (!sb) return
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const profile = await fetchProfile(session.user.id)
    if (profile) setState((current) => (current.session ? { ...current, profile } : current))
  }, [])

  const updateName = useCallback(async (fullName) => {
    if (!isAuthEnabled()) throw new Error('Cloud profiles are not configured on this deployment.')
    const { error } = await supabase().rpc('save_profile', { p_full_name: fullName })
    if (error) throw new Error(error.message)
    await refreshProfile()
  }, [refreshProfile])

  const updatePassword = useCallback(async (password) => {
    if (!isAuthEnabled()) throw new Error('Cloud profiles are not configured on this deployment.')
    const { error } = await supabase().auth.updateUser({ password })
    if (error) throw new Error(error.message)
  }, [])

  const clearNotice = useCallback(() => setState((current) => ({ ...current, notice: null })), [])

  const value = useMemo(() => ({
    ...state, signIn, signUp, signOut, refreshProfile, updateName, updatePassword, clearNotice,
  }), [state, signIn, signUp, signOut, refreshProfile, updateName, updatePassword, clearNotice])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx) || LOCAL
}
