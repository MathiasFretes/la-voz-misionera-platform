import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  className = '',
) {
  return `button ${variant} ${className}`.trim()
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      loading = false,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={buttonClass(variant, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      />
    )
  },
)
