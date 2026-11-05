export function PageHeader({ eyebrow, title, description, actions, meta, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0 max-w-reading">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">{eyebrow}</p>}
        <h1 className="text-display-sm font-semibold">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-fg-muted">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ title, description, action, id, className = '' }) {
  return (
    <div className={`mb-3 flex flex-wrap items-end justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
