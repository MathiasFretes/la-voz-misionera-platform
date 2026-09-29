import type { HTMLAttributes } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={`ui-badge ui-badge-${tone} ${className}`.trim()}
    />
  )
}

export type StatusBadgeProps = {
  dimension: string
  value: string
  tone?: BadgeTone
  className?: string
}

export function StatusBadge({
  dimension,
  value,
  tone = 'neutral',
  className = '',
}: StatusBadgeProps) {
  return (
    <Badge tone={tone} className={`ui-status-badge ${className}`.trim()}>
      <span className="ui-status-dimension">{dimension}</span>
      <strong>{value}</strong>
    </Badge>
  )
}
