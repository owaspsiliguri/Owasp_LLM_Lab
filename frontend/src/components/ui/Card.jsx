export default function Card({ as: Tag = 'section', className = '', interactive = false, padded = false, children, ...props }) {
  return (
    <Tag
      className={['card', interactive ? 'card-hover' : '', padded ? 'card-pad' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, action, as: Tag = 'header', className = '' }) {
  return (
    <Tag className={`flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-5 text-fg-subtle">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </Tag>
  )
}

export function CardBody({ className = '', children }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
