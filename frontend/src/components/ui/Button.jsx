const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  outline: '',
}

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

/**
 * The only button used in the interface. `as` lets it render as a router Link
 * while keeping the same padding, focus ring and disabled behaviour.
 */
export default function Button({
  as: Tag = 'button',
  variant = 'secondary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  type,
  ...props
}) {
  const isButton = Tag === 'button'
  const classes = ['btn', VARIANTS[variant] ?? '', SIZES[size] ?? '', className].filter(Boolean).join(' ')
  return (
    <Tag
      className={classes}
      {...(isButton ? { type: type || 'button', disabled: disabled || loading } : {})}
      {...(isButton && loading ? { 'aria-busy': 'true' } : {})}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          aria-hidden
        />
      )}
      {children}
    </Tag>
  )
}
