import Icon from '../Icons.jsx'
import Button from './Button.jsx'

export function Skeleton({ className = '', as: Tag = 'div' }) {
  return <Tag className={`skeleton ${className}`} aria-hidden />
}

export function Loading({ error, children, onRetry }) {
  if (error) {
    return (
      <div role="alert" className="card border-danger-line p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-danger"><Icon name="alert" size={18} /></span>
          <div className="min-w-0">
            <p className="font-medium text-fg">Could not reach the backend</p>
            <p className="mt-1 text-sm leading-6 text-fg-muted">
              {error}. Check that the stack is running with{' '}
              <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs text-fg">docker compose up</code>.
            </p>
            {onRetry && <Button size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-fg-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden />
      {children || 'Loading…'}
    </div>
  )
}

export function EmptyState({ icon = 'info', title, body, action, className = '' }) {
  return (
    <div className={`card flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-muted">
        <Icon name={icon} size={18} />
      </span>
      <h2 className="mt-3 text-sm font-semibold text-fg">{title}</h2>
      {body && <p className="mt-1 max-w-sm text-sm leading-6 text-fg-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ProgressBar({
  value = 0, max = 100, label, showValue = false, size = 'md', tone = 'accent', className = '',
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  const fill = { accent: 'bg-accent', success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning' }[tone] || 'bg-accent'
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          {label && <span className="text-fg-muted">{label}</span>}
          {showValue && <span className="font-medium tabular-nums text-fg">{percent}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${percent}% complete`}
        className={`w-full overflow-hidden rounded-full bg-surface-3 ${size === 'sm' ? 'h-1.5' : 'h-2'}`}
      >
        <div className={`h-full rounded-full ${fill} transition-[width] duration-300`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, delta, icon, tone = 'default' }) {
  const tint = tone === 'accent' ? 'bg-accent-tint text-accent-text' : tone === 'danger' ? 'bg-danger-tint text-danger-text' : 'bg-surface-2 text-fg-muted'
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
        {icon && <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${tint}`}><Icon name={icon} size={14} /></span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
        {delta !== undefined && delta !== null && (
          <span className={`text-xs font-medium ${delta >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs leading-5 text-fg-subtle">{hint}</p>}
    </div>
  )
}
