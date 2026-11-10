import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import type { ChestReward } from '../types/api'
import { ChestOverlay } from './ChestOverlay'
import { chestView } from './chestView'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

const rewards: ChestReward[] = [
  { id: 'chest-xp', kind: 'xp', label: 'Bonus XP', amount: 40 },
  { id: 'chest-coins', kind: 'coins', label: 'Crypt coins', amount: 60 },
  { id: 'chest-badge', kind: 'badge', label: 'First Blood' },
]

afterEach(() => {
  cleanup()
  rm.reduced = false
})

const rewardArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  kind: fc.constantFrom('xp', 'coins', 'weapon', 'badge') as fc.Arbitrary<ChestReward['kind']>,
  label: fc.string({ minLength: 1, maxLength: 20 }),
  amount: fc.option(fc.integer({ min: 0, max: 9999 }), { nil: undefined }),
})

describe('chestView', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 15: Chest shows exactly the rewards
  // **Validates: Requirements 11.4, 11.5**
  it('Property 15: same items in the same order; empty or missing gives no Chest', () => {
    fc.assert(
      fc.property(fc.array(rewardArb, { maxLength: 12 }), (list) => {
        const view = chestView(list)
        if (list.length === 0) {
          expect(view).toBeNull()
          return
        }
        expect(view?.items.map((i) => [i.id, i.kind, i.label])).toEqual(list.map((r) => [r.id, r.kind, r.label]))
        expect(view?.items.map((i) => i.amountText)).toEqual(list.map((r) => (r.amount === undefined ? null : `+${r.amount}`)))
      }),
      { numRuns: 100 },
    )
    expect(chestView(undefined)).toBeNull()
    expect(chestView(null)).toBeNull()
  })
})

describe('ChestOverlay', () => {
  it('lists exactly the rewards and focuses Collect', () => {
    render(<ChestOverlay rewards={rewards} onClose={() => undefined} />)
    const items = within(screen.getByRole('list', { name: 'Chest contents' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Bonus XP+40', 'Crypt coins+60', 'First Blood'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Collect' }))
  })

  it('renders nothing when the rewards are empty or missing', () => {
    const { container, rerender } = render(<ChestOverlay rewards={[]} onClose={() => undefined} />)
    expect(container.firstChild).toBeNull()
    rerender(<ChestOverlay rewards={undefined} onClose={() => undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('closes with Collect or Escape and keeps Tab focus inside', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <>
        <button type="button">outside</button>
        <ChestOverlay rewards={rewards} onClose={onClose} />
      </>,
    )
    await user.tab()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    await user.tab({ shift: true })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Collect' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('opens at once and is static under reduced motion', () => {
    rm.reduced = true
    render(<ChestOverlay rewards={rewards} onClose={() => undefined} />)
    expect(screen.getByTestId('chest-art').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('chest-overlay').getAttribute('data-reduced')).toBe('true')
    expect(screen.getByText('Your floor reward')).toBeTruthy()
  })

  it('opens the lid after a short delay when motion is allowed', async () => {
    vi.useFakeTimers()
    render(<ChestOverlay rewards={rewards} onClose={() => undefined} />)
    expect(screen.getByTestId('chest-art').getAttribute('data-open')).toBe('false')
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.getByTestId('chest-art').getAttribute('data-open')).toBe('true')
    vi.useRealTimers()
  })
})
