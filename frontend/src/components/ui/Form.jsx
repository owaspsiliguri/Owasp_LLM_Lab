import { useId } from 'react'

/**
 * Label + hint + error wrapper. Children may be a node or a render function that
 * receives the id and aria-describedby so inputs stay wired up automatically.
 */
export function Field({ label, hint, error, children, htmlFor, className = '' }) {
  const generated = useId()
  const id = htmlFor || generated
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }) : children}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-fg-subtle">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>}
    </div>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />
}

export function Textarea({ className = '', mono = false, ...props }) {
  return <textarea className={`input ${mono ? 'input-mono' : ''} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`input pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}
