import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ControlsHint } from './ControlsHint'

describe('ControlsHint', () => {
  it('renders a labelled list of key chips and accepts className', () => {
    render(<ControlsHint className="extra" />)
    const list = screen.getByRole('list', { name: 'Controls' })
    expect(list.className).toContain('extra')
    const keys = Array.from(list.querySelectorAll('kbd')).map((k) => k.textContent)
    expect(keys).toEqual(['WASD', 'Arrows', 'E', '1-4', 'Enter', 'Esc', 'F'])
  })
})
