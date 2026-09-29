import type { ReactNode } from 'react'

export type PageHeaderProps = {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`page-heading ${className}`.trim()}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  )
}
