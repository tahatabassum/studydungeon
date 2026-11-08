import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ControlsLegend } from './ControlsLegend'

afterEach(cleanup)

describe('ControlsLegend', () => {
  it('shows the controls directly in full mode', () => {
    render(<ControlsLegend compact={false} />)
    expect(screen.getByRole('list', { name: 'Controls' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /controls/i })).toBeNull()
  })

  it('collapses behind a toggle in compact mode', async () => {
    render(<ControlsLegend compact />)
    const toggle = screen.getByRole('button', { name: 'Controls' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('list', { name: 'Controls' })).toBeNull()
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide controls' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('list', { name: 'Controls' })).toBeTruthy()
  })
})
