import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EncounterPopupProps } from './EncounterPopup'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/state/useReducedMotion', () => ({ useReducedMotion: () => rm.reduced }))

import { EncounterPopup, EXIT_MS } from './EncounterPopup'
import type { AnswerResult } from '@/types/api'

const question = {
  id: 'q1',
  type: 'mcq' as const,
  prompt: 'What powers the cell?',
  options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
}

const result = (over: Partial<AnswerResult> = {}): AnswerResult => ({
  correct: true,
  damage_dealt: 20,
  monster_hp_remaining: 10,
  player_hp_remaining: 80,
  score_delta: 10,
  xp_delta: 5,
  streak: 1,
  source: { page: 3, chunk_id: 'c1' },
  review_status: 'not_due',
  ...over,
})

function props(over: Partial<EncounterPopupProps> = {}): EncounterPopupProps {
  return {
    question,
    combat: 'question',
    monsterName: 'Slime',
    monsterKind: 'toxic_slime',
    isBoss: false,
    roomOrder: 2,
    onAnswer: vi.fn(),
    onNext: vi.fn(),
    onRetreat: vi.fn(),
    keysEnabled: true,
    ...over,
  }
}

function setup(over: Partial<EncounterPopupProps> = {}) {
  const p = props(over)
  const utils = render(<EncounterPopup {...p} />)
  return { p, ...utils }
}

afterEach(() => {
  cleanup()
  rm.reduced = false
  vi.useRealTimers()
})

describe('EncounterPopup layout and focus', () => {
  it('shows the candle and focuses the speech panel container, not an option', () => {
    setup()
    expect(screen.getByTestId('spellbook-candle')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('enters from the side given by room order parity and the boss from the right', () => {
    const { unmount } = setup({ roomOrder: 2 })
    expect(screen.getByTestId('encounter-popup').getAttribute('data-side')).toBe('left')
    unmount()
    const again = setup({ roomOrder: 1 })
    expect(screen.getByTestId('encounter-popup').getAttribute('data-side')).toBe('right')
    again.unmount()
    setup({ roomOrder: 2, isBoss: true })
    expect(screen.getByTestId('encounter-popup').getAttribute('data-side')).toBe('right')
  })

  it('draws the mapped character for the monster kind (Skeleton for unknown kinds)', () => {
    const { container, unmount } = setup({ monsterKind: 'gear_golem' })
    expect(container.querySelector('canvas')?.getAttribute('data-character')).toBe('golem')
    unmount()
    const other = setup({ monsterKind: 'nobody_knows' })
    expect(other.container.querySelector('canvas')?.getAttribute('data-character')).toBe('skeleton')
  })

  it('marks the pop-up reduced so slides and bobs stay off', () => {
    rm.reduced = true
    setup()
    expect(screen.getByTestId('encounter-popup').getAttribute('data-reduced')).toBe('true')
  })

  it('leaves the pop-up animated by default', () => {
    setup()
    expect(screen.getByTestId('encounter-popup').getAttribute('data-reduced')).toBeNull()
  })

  it('traps Tab inside the panel', () => {
    setup()
    const panel = screen.getByRole('dialog')
    const buttons = within(panel).getAllByRole('button')
    const last = buttons[buttons.length - 1]
    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(buttons[0])
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('pulls focus back into the panel if it leaves while the keys are enabled', () => {
    setup()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    outside.remove()
  })

  it('returns focus to the game when the pop-up unmounts', () => {
    const game = document.createElement('div')
    game.setAttribute('role', 'application')
    game.tabIndex = 0
    document.body.appendChild(game)
    const { unmount } = setup()
    unmount()
    expect(document.activeElement).toBe(game)
    game.remove()
  })
})

describe('EncounterPopup typewriter', () => {
  it('exposes the full question to assistive technology from the first frame', () => {
    setup()
    const heading = screen.getByRole('heading')
    expect(heading.querySelector('.sr-only')?.textContent).toBe(question.prompt)
    // The animated copy is hidden from assistive technology.
    expect(heading.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('shows the question text at once under reduced motion', () => {
    rm.reduced = true
    setup()
    const visible = screen.getByRole('heading').querySelector('[data-part="visible"]')
    expect(visible?.textContent).toBe(question.prompt)
  })

  it('completes the typing on Space', () => {
    vi.useFakeTimers()
    setup({ combat: 'question' })
    const visible = () => screen.getByRole('heading').querySelector('[data-part="visible"]')
    // The taunt is typing first, so the question is not shown yet.
    expect(visible()?.textContent).toBe('')
    // First Space completes the taunt, which starts the question; the second completes the question.
    fireEvent.keyDown(window, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(40)
    })
    expect(visible()?.textContent).not.toBe(question.prompt)
    fireEvent.keyDown(window, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(40)
    })
    expect(visible()?.textContent).toBe(question.prompt)
  })
})

describe('EncounterPopup answering', () => {
  it('number keys 1-4 answer with the matching option', () => {
    const { p } = setup()
    fireEvent.keyDown(window, { key: '2' })
    expect(p.onAnswer).toHaveBeenCalledWith('Mitochondria')
  })

  it('ignores number keys when keys are disabled', () => {
    const { p } = setup({ keysEnabled: false })
    fireEvent.keyDown(window, { key: '1' })
    expect(p.onAnswer).not.toHaveBeenCalled()
  })

  it('submits once for a rapid click plus key press', () => {
    const { p } = setup()
    const btn = screen.getByRole('button', { name: /Nucleus$/ })
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.keyDown(window, { key: '1' })
    expect(p.onAnswer).toHaveBeenCalledTimes(1)
  })

  it('disables options outside the question state', () => {
    setup({ combat: 'submitting' })
    for (const name of question.options) {
      expect((screen.getByRole('button', { name: new RegExp(`${name}$`) }) as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('uses two wide buttons for true/false questions', () => {
    const { container } = setup({ question: { id: 'tf', type: 'true_false', prompt: 'Is it?', options: ['True', 'False', 'Maybe'] } })
    expect(container.querySelector('[data-layout="wide"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Maybe$/ })).toBeNull()
  })
})

describe('EncounterPopup retreat and next', () => {
  it('shows Retreat only in the question state and calls onRetreat', () => {
    const { p } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Retreat from battle' }))
    expect(p.onRetreat).toHaveBeenCalledTimes(1)
  })

  it('hides Retreat when not in the question state', () => {
    setup({ combat: 'next', result: result() })
    expect(screen.queryByRole('button', { name: 'Retreat from battle' })).toBeNull()
  })

  it.each(['next', 'monster_defeated', 'player_defeated'] as const)('shows Next in %s and Enter continues', (combat) => {
    const { p } = setup({ combat, result: result() })
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(p.onNext).toHaveBeenCalledTimes(1)
  })

  it('does not show Next while answering', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })
})

describe('EncounterPopup result view', () => {
  it('shows the backend damage, the source line and the explanation', () => {
    setup({ combat: 'next', result: result({ damage_dealt: 37, explanation: 'Mitochondria make ATP.' }) })
    expect(screen.getByText('Correct!')).toBeTruthy()
    expect(screen.getByText('You dealt 37 damage')).toBeTruthy()
    expect(screen.getByText(/From your notes: page 3/)).toBeTruthy()
    expect(screen.getByText('Mitochondria make ATP.')).toBeTruthy()
  })

  it('omits the explanation when absent', () => {
    setup({ combat: 'next', result: result() })
    expect(screen.queryByText('Mitochondria make ATP.')).toBeNull()
    expect(screen.getByText(/From your notes: page 3/)).toBeTruthy()
  })

  it('renders incorrect feedback with damage received', () => {
    setup({ combat: 'next', result: result({ correct: false, damage_dealt: 0 }), damageReceived: 15 })
    expect(screen.getAllByText(/Incorrect/).length).toBeGreaterThan(0)
    expect(screen.getByText('You took 15 damage')).toBeTruthy()
  })

  it('announces the result through a status region', () => {
    setup({ combat: 'next', result: result() })
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('Correct!')
  })

  it('switches the portrait pose to hurt on a correct answer and taunt on a wrong one', () => {
    const hurt = setup({ combat: 'next', result: result() })
    expect(hurt.container.querySelector('canvas')?.getAttribute('data-pose')).toBe('hurt')
    hurt.unmount()
    const taunt = setup({ combat: 'next', result: result({ correct: false }) })
    expect(taunt.container.querySelector('canvas')?.getAttribute('data-pose')).toBe('taunt')
  })

  it('names the dialog with the question prompt and the monster', () => {
    setup()
    expect(screen.getByRole('dialog', { name: question.prompt })).toBeTruthy()
    expect(screen.getByText('Slime blocks your way')).toBeTruthy()
  })
})

describe('EncounterPopup exit', () => {
  it('slides out for 300 ms after the encounter ends, then unmounts', () => {
    vi.useFakeTimers()
    const p = props()
    const { rerender } = render(<EncounterPopup {...p} />)
    rerender(<EncounterPopup {...p} question={null} combat={null} />)
    expect(screen.getByTestId('encounter-popup').getAttribute('data-closing')).toBe('true')
    act(() => {
      vi.advanceTimersByTime(EXIT_MS + 5)
    })
    expect(screen.queryByTestId('encounter-popup')).toBeNull()
  })

  it('does not slide out under reduced motion', () => {
    rm.reduced = true
    const p = props()
    const { rerender } = render(<EncounterPopup {...p} />)
    rerender(<EncounterPopup {...p} question={null} combat={null} />)
    expect(screen.queryByTestId('encounter-popup')).toBeNull()
  })
})
