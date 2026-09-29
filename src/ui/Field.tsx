import { useId, type ReactNode } from 'react'

export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

export type FieldProps = {
  label: string
  children: (control: FieldControlProps) => ReactNode
  id?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
}

export function Field({
  label,
  children,
  id,
  hint,
  error,
  required,
  className = '',
}: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={controlId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}
      {hint && (
        <small className="ui-field-hint" id={hintId}>
          {hint}
        </small>
      )}
      {error && (
        <small className="ui-field-error" id={errorId}>
          {error}
        </small>
      )}
    </div>
  )
}
