import type { HTMLAttributes } from 'react'

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'article' | 'section'
  padded?: boolean
}

export function Card({
  as: Element = 'div',
  padded = true,
  className = '',
  ...props
}: CardProps) {
  return (
    <Element
      {...props}
      className={`ui-card${padded ? ' ui-card-padded' : ''} ${className}`.trim()}
    />
  )
}
