const TONES = {
  neutral: 'badge-neutral',
  brand: 'badge-brand',
  success: 'badge-success',
  danger: 'badge-danger',
  warning: 'badge-warning',
  Beginner: 'badge-beginner',
  Intermediate: 'badge-intermediate',
  Advanced: 'badge-advanced',
  Expert: 'badge-expert',
}

export default function Badge({ children, tone = 'neutral', icon: Icon, className = '' }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.neutral} ${className}`}>
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  )
}

export function DifficultyBadge({ level }) {
  return <Badge tone={level}>{level}</Badge>
}
