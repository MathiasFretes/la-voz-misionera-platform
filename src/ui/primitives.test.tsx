import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { Field } from './Field'
import { Tabs } from './Tabs'

afterEach(cleanup)

describe('LVM UI primitives', () => {
  it('keeps a loading button disabled', async () => {
    const action = vi.fn()
    render(
      <Button loading onClick={action}>
        Guardar
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.setup().click(button)
    expect(action).not.toHaveBeenCalled()
  })

  it('associates field help and errors with its control', () => {
    render(
      <Field
        label="Nombre"
        hint="Nombre visible"
        error="Es obligatorio"
        required
      >
        {(control) => <input {...control} />}
      </Field>,
    )

    const input = screen.getByRole('textbox', { name: 'Nombre' })
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(2)
    expect(screen.getByText('Nombre visible')).toHaveAttribute(
      'id',
      describedBy.split(' ')[0],
    )
    expect(screen.getByText('Es obligatorio')).toHaveAttribute(
      'id',
      describedBy.split(' ')[1],
    )
  })

  it('moves through enabled tabs with the keyboard', async () => {
    function Example() {
      const [active, setActive] = useState('order')
      return (
        <Tabs
          label="Servicio"
          items={[
            { id: 'order', label: 'Orden', panelId: 'order-panel' },
            {
              id: 'information',
              label: 'Información',
              panelId: 'information-panel',
              disabled: true,
            },
            {
              id: 'presentation',
              label: 'Presentación',
              panelId: 'presentation-panel',
            },
          ]}
          activeId={active}
          onChange={setActive}
        />
      )
    }

    render(<Example />)
    const order = screen.getByRole('tab', { name: 'Orden' })
    order.focus()
    await userEvent.setup().keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Presentación' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Presentación' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
