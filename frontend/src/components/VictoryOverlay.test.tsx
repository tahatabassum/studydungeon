import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { countUpValue, COUNT_UP_STEPS } from './useCountUp'
import { VICTORY_FX_COUNT } from './fxCounts'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

import { VictoryOverlay } from './VictoryOverlay'

const summary = { score: 300, xp: 120, correct: 8, total: 10, accuracy: 0.8 }
const noop = () => {}

afterEach(() => {
  cleanup()
  rm.reduced = false
  vi.useRealTimers()
})

describe('VictoryOverlay', () => {
  it('keeps decorative elements at or below 24', () => {
    expect(VICTORY_FX_COUNT).toBeLessThanOrEqual(24)
    render(<VictoryOverlay summary={summary} onPlayAgain={noop} onExit={noop} />)
    const fx = screen.getByTestId('victory-fx')
    expect(fx.querySelectorAll('[data-fx]').length).toBe(VICTORY_FX_COUNT)
  })

  it('counts XP up in steps and ends on the final value', () => {
    vi.useFakeTimers()
    render(<VictoryOverlay summary={summary} onPlayAgain={noop} onExit={noop} />)
    expect(screen.getByTestId('xp-counter').textContent).toBe('0')
    act(() => {
      vi.advanceTimersByTime(60 * COUNT_UP_STEPS + 10)
    })
    expect(screen.getByTestId('xp-counter').textContent).toBe('120')
  })

  it('shows the final XP at once under reduced motion', () => {
    rm.reduced = true
    render(<VictoryOverlay summary={summary} onPlayAgain={noop} onExit={noop} />)
    expect(screen.getByTestId('xp-counter').textContent).toBe('120')
    expect(screen.getByRole('dialog').getAttribute('data-reduced')).toBe('true')
  })

  it('focuses Play again on mount', () => {
    render(<VictoryOverlay summary={summary} onPlayAgain={noop} onExit={noop} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Play again' }))
  })
})

describe('countUpValue', () => {
  it('is monotonic and ends exactly at the target', () => {
    let prev = -1
    for (let s = 0; s <= COUNT_UP_STEPS; s++) {
      const v = countUpValue(137, s)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(countUpValue(137, COUNT_UP_STEPS)).toBe(137)
    expect(countUpValue(137, 0)).toBe(0)
  })
})
