import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setUnauthorizedHandler } from '../services/api.js'

const LOCAL = {
  enabled: false,
  registration: false,
  mode: 'open',
  user: null,
  session: null,
  profile: null,
  loading: false,
  profileLoading: false,
  notice: null,
}
const Ctx = createContext(null)
const SESSION_CHECK_MS = 5 * 60 * 1000

function signedOut(extra = {}) {
  return {
    enabled: true,
    registration: false,
    mode: 'local',
    user: null,
    session: null,
    profile: null,
    loading: false,
    profileLoading: false,
    notice: null,
    ...extra,
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    ...LOCAL,
    enabled: false,
    loading: true,
    configured: false,
  })

  useEffect(() => {
    let live = true

    async function boot() {
      let config
      try {
        config = await api.authConfig()
      } catch (error) {
        if (!live) return
        setState({
          ...LOCAL,
          loading: false,
          notice: `Could not reach the authentication service: ${error.message}`,
        })
        return
      }
      if (!live) return
      if (!config.enabled) {
        setState({
          ...LOCAL,
          enabled: false,
          registration: false,
          mode: config.mode || 'open',
          configured: true,
          loading: false,
        })
        return
      }

      let user = null
      try {
        const me = await api.me()
        user = me?.user || null
      } catch {
        // A 401 is not an error here: the visitor is simply signed out.
      }
      if (!live) return
      setState({
        enabled: true,
        registration: Boolean(config.registration),
        mode: config.mode || 'local',
        configured: true,
        user,
        session: user ? { user } : null,
        profile: user,
        loading: false,
        profileLoading: false,
        notice: null,
      })
    }

    void boot()
    return () => { live = false }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState((current) => {
        if (!current.user) return current
        return {
          ...current,
          user: null,
          session: null,
          profile: null,
          loading: false,
          notice: 'Your session ended. Sign in again to continue where you left off.',
        }
      })
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (!state.enabled || !state.user) return undefined
    let lastCheck = 0
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheck < SESSION_CHECK_MS) return
      lastCheck = now
      try {
        const me = await api.me()
        const user = me?.user || null
        setState((current) => {
          if (!current.user) return current
          if (!user) {
            return {
              ...current,
              user: null,
              session: null,
              profile: null,
              notice: 'Your session ended. Sign in again to continue where you left off.',
            }
          }
          return { ...current, user, session: { user }, profile: user }
        })
      } catch { /* transient failure: keep the current session */ }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [state.enabled, state.user])

  const adoptUser = useCallback((user) => {
    setState((current) => ({
      ...current,
      enabled: true,
      user,
      session: user ? { user } : null,
      profile: user,
      loading: false,
      profileLoading: false,
      notice: null,
    }))
  }, [])

  const signIn = useCallback(async (email, password) => {
    const result = await api.login(email.trim(), password)
    adoptUser(result.user)
    return result.user
  }, [adoptUser])

  const signUp = useCallback(async ({ fullName, email, password }) => {
    const result = await api.register({ email: email.trim(), password, fullName })
    if (result.user) adoptUser(result.user)
    return {
      needsConfirmation: Boolean(result.needs_confirmation),
      user: result.user || null,
    }
  }, [adoptUser])

  const signOut = useCallback(async () => {
    try { await api.logout() } catch { /* clear the browser state regardless */ }
    setState((current) => signedOut({
      enabled: current.enabled,
      registration: current.registration,
      mode: current.mode,
    }))
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const result = await api.me()
      const user = result?.user || null
      setState((current) => (user
        ? { ...current, user, session: { user }, profile: user }
        : { ...current, user: null, session: null, profile: null }))
      return user
    } catch {
      return null
    }
  }, [])

  const updateName = useCallback(async (fullName) => {
    if (!state.enabled) throw new Error('This deployment has no account system attached.')
    const result = await api.updateProfile(fullName)
    if (result?.user) adoptUser(result.user)
  }, [adoptUser, state.enabled])

  const updatePassword = useCallback(async (currentPassword, newPassword) => {
    if (!state.enabled) throw new Error('This deployment has no account system attached.')
    const result = await api.changePassword(currentPassword, newPassword)
    if (result?.signed_out) {
      setState((current) => signedOut({
        enabled: current.enabled,
        registration: current.registration,
        mode: current.mode,
        notice: 'Password changed. Every session was signed out; sign in again with the new password.',
      }))
    }
    return result
  }, [state.enabled])

  const clearNotice = useCallback(() => setState((current) => ({ ...current, notice: null })), [])

  const value = useMemo(() => ({
    ...state,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    updateName,
    updatePassword,
    clearNotice,
  }), [state, signIn, signUp, signOut, refreshProfile, updateName, updatePassword, clearNotice])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx) || LOCAL
}
