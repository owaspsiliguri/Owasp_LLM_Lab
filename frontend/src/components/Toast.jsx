import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icons.jsx'

const ToastContext = createContext(null)
const TONES = {
  success: ['border-emerald-200', 'text-emerald-600', 'check'],
  error: ['border-red-200', 'text-red-600', 'alert'],
  warning: ['border-amber-200', 'text-amber-600', 'alert'],
  info: ['border-line', 'text-brand-600', 'info'],
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((message, { tone = 'info', title } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((list) => [...list.slice(-3), { id, message, tone, title }])
    timers.current.set(id, setTimeout(() => dismiss(id), 4500))
  }, [dismiss])

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
  }, [])

  const value = useMemo(() => ({
    push,
    dismiss,
    success: (message, options) => push(message, { ...options, tone: 'success' }),
    error: (message, options) => push(message, { ...options, tone: 'error' }),
    warning: (message, options) => push(message, { ...options, tone: 'warning' }),
    info: (message, options) => push(message, { ...options, tone: 'info' }),
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const [border, colour, icon] = TONES[toast.tone] || TONES.info
          return (
            <div key={toast.id} className={`toast animate-toast-in ${border}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <span className={`mt-0.5 shrink-0 ${colour}`}><Icon name={icon} size={18} /></span>
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-sm font-semibold text-ink">{toast.title}</p>}
                <p className="text-sm text-slate-600">{toast.message}</p>
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Dismiss notification">
                <Icon name="close" size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

const NOOP = {
  push: () => {}, dismiss: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {},
}

export function useToast() {
  return useContext(ToastContext) || NOOP
}
