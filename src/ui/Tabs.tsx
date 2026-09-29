import type { KeyboardEvent } from 'react'

export type TabItem = {
  id: string
  label: string
  panelId: string
  disabled?: boolean
}

export type TabsProps = {
  label: string
  items: readonly TabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({
  label,
  items,
  activeId,
  onChange,
  className = '',
}: TabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const enabled = items.filter((item) => !item.disabled)
    if (enabled.length === 0) return
    const current = enabled.findIndex((item) => item.id === id)
    let next: number
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length
    else if (event.key === 'ArrowLeft')
      next = (current - 1 + enabled.length) % enabled.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else return

    event.preventDefault()
    const target = enabled[next]
    onChange(target.id)
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      )
    Array.from(buttons ?? [])
      .find((button) => button.dataset.tabId === target.id)
      ?.focus()
  }

  return (
    <div
      className={`tabs ${className}`.trim()}
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${item.panelId}-tab`}
          data-tab-id={item.id}
          aria-controls={item.panelId}
          aria-selected={item.id === activeId}
          tabIndex={item.id === activeId ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => handleKeyDown(event, item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
