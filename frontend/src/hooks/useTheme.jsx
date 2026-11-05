import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'lll.theme'
const MODES = ['system', 'light', 'dark']
const Ctx = createContext(null)

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function storedMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0e1114')
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(storedMode)
  const [system, setSystem] = useState(systemTheme)

  const theme = mode === 'system' ? system : mode

  useEffect(() => {
    apply(theme)
  }, [theme])

  useEffect(() => {
    if (!window.matchMedia) return undefined
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (event) => setSystem(event.matches ? 'light' : 'dark')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return
    setModeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
  }, [])

  const toggle = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setMode])

  const value = useMemo(() => ({ theme, mode, setMode, toggle }), [theme, mode, setMode, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * A theme is never critical, so a component rendered outside the provider (a
 * test harness, an isolated preview) gets a working fallback instead of an
 * exception that would blank the whole tree.
 */
export function useTheme() {
  const ctx = useContext(Ctx)
  const [fallback, setFallback] = useState(() => (
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  ))

  const setFallbackTheme = useCallback((next) => {
    const theme = next === 'system' ? systemTheme() : next
    apply(theme)
    setFallback(theme)
  }, [])

  const fallbackToggle = useCallback(() => {
    setFallbackTheme(fallback === 'dark' ? 'light' : 'dark')
  }, [fallback, setFallbackTheme])

  const fallbackValue = useMemo(
    () => ({ theme: fallback, mode: fallback, setMode: setFallbackTheme, toggle: fallbackToggle }),
    [fallback, setFallbackTheme, fallbackToggle],
  )

  return ctx || fallbackValue
}
