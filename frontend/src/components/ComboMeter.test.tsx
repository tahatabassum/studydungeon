import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ComboMeter } from './ComboMeter'
import { comboTier as learningTier, comboValue } from '../learning/combo'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

afterEach(() => {
  cleanup()
  rm.reduced = false
})

describe('ComboMeter', () => {
  it('shows nothing below streak 3', () => {
    const { container } = render(<ComboMeter value={2} />)
    expect(container.firstChild).toBeNull()
  })

  it.each([
    [3, 'Combo', '1'],
    [5, 'Hot', '2'],
    [8, 'Blazing', '3'],
    [12, 'Legendary', '4'],
  ])('streak %i is the %s tier with an accessible label', (value, name, tier) => {
    render(<ComboMeter value={value} />)
    const meter = screen.getByTestId('combo-meter')
    expect(meter.getAttribute('data-tier')).toBe(tier)
    expect(screen.getByRole('group', { name: `Combo ${name}, streak ${value}` })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(`${name} combo`)
    expect(meter.querySelectorAll('.sd-combo__pips i').length).toBe(Number(tier))
  })

  it('marks reduced motion so no tier animates', () => {
    rm.reduced = true
    render(<ComboMeter value={12} />)
    expect(screen.getByTestId('combo-meter').getAttribute('data-reduced')).toBe('true')
  })
})

describe('learning/combo', () => {
  it('re-exports the pure tier and prefers combo over streak', () => {
    expect(learningTier(8)).toBe(3)
    expect(comboValue(7, 2)).toBe(7)
    expect(comboValue(undefined, 4)).toBe(4)
    expect(comboValue(undefined, -1)).toBe(0)
  })
})
