import { useId, useMemo } from 'react'
import Icon from './Icons.jsx'

const TONE_CLASS = {
  neutral: 'badge-neutral', brand: 'badge-brand',
  Beginner: 'badge-beginner', Intermediate: 'badge-intermediate',
  Advanced: 'badge-advanced', Expert: 'badge-expert',
  success: 'badge-success', danger: 'badge-danger', warning: 'badge-warning',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge ${TONE_CLASS[tone] || TONE_CLASS.neutral} ${className}`}>{children}</span>
}

export function DifficultyBadge({ level }) {
  return <Badge tone={level}>{level}</Badge>
}

const PY_KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'as', 'with', 'try',
  'except', 'finally', 'raise', 'pass', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'lambda',
  'async', 'await', 'yield', 'global', 'assert', 'del', 'break', 'continue',
])
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'UNION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'JOIN',
  'ON', 'AND', 'OR', 'VALUES', 'INTO', 'SET', 'ORDER', 'BY', 'LIMIT',
])

function highlight(code, language) {
  const keywords = language === 'sql' ? SQL_KEYWORDS : PY_KEYWORDS
  const pattern = language === 'sql'
    ? /(--[^\n]*)|('(?:[^']|'')*')|\b([A-Za-z_]+)\b|\b(\d+)\b/g
    : /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*')|\b([A-Za-z_]+)\b|\b(\d+)\b/g
  const nodes = []
  let last = 0
  let match
  let key = 0
  while ((match = pattern.exec(code)) !== null) {
    if (match.index > last) nodes.push(code.slice(last, match.index))
    const token = match[0]
    if (match[1]) nodes.push(<span key={key++} className="text-slate-500">{token}</span>)
    else if (match[2]) nodes.push(<span key={key++} className="text-emerald-300">{token}</span>)
    else if (match[3] && keywords.has(language === 'sql' ? token.toUpperCase() : token)) {
      nodes.push(<span key={key++} className="text-sky-300">{token}</span>)
    } else if (match[3]) nodes.push(<span key={key++} className="text-slate-100">{token}</span>)
    else if (match[4]) nodes.push(<span key={key++} className="text-amber-300">{token}</span>)
    else nodes.push(token)
    last = match.index + token.length
  }
  if (last < code.length) nodes.push(code.slice(last))
  return nodes
}

export function CodeBlock({ code, label, tone = 'neutral', language = 'python', className = '', wrap = false }) {
  const edge = tone === 'vuln' ? 'border-red-900/70' : tone === 'safe' ? 'border-emerald-900/70' : 'border-ink-700'
  const body = useMemo(() => highlight(String(code ?? ''), language), [code, language])
  return (
    <figure className={`overflow-hidden rounded-xl border ${edge} bg-ink-950 ${className}`}>
      {label && (
        <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-medium text-slate-300">
          <span className="truncate">{label}</span>
          {tone === 'vuln' && <span className="badge border-red-500/30 bg-red-500/10 text-red-300">Vulnerable</span>}
          {tone === 'safe' && <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Secure</span>}
        </figcaption>
      )}
      <pre className={`max-h-[30rem] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-slate-200 ${wrap ? 'whitespace-pre-wrap break-words' : ''}`}>
        <code>{body}</code>
      </pre>
    </figure>
  )
}

export function Stat({ label, value, hint, icon, tone = 'default' }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone === 'brand' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function ProgressBar({ value = 0, max = 100, label, size = 'md', className = '' }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{label}</span><span className="font-medium text-slate-600">{percent}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={`w-full overflow-hidden rounded-full bg-slate-200/80 ${size === 'sm' ? 'h-1.5' : 'h-2'}`}
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function Loading({ error, children, onRetry }) {
  if (error) {
    return (
      <div role="alert" className="card border-red-200 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-red-600"><Icon name="alert" /></span>
          <div className="min-w-0">
            <p className="font-medium text-ink">Could not reach the backend</p>
            <p className="mt-1 text-sm text-slate-600">{error}. Check that the stack is running with <code className="rounded bg-slate-100 px-1 font-mono text-xs">docker compose up</code>.</p>
            {onRetry && <button type="button" className="btn btn-sm mt-3" onClick={onRetry}>Try again</button>}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-brand-600" aria-hidden />
      {children || 'Loading…'}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function EmptyState({ icon = 'info', title, body, action }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon name={icon} size={20} /></span>
      <h2 className="mt-3 font-medium text-ink">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionTitle({ title, description, action, id }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id={id} className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor }) {
  const generated = useId()
  const id = htmlFor || generated
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children({ id, 'aria-describedby': describedBy }) : children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
