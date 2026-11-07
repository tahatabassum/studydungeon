import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuestionPanel, type QuestionPanelProps } from './QuestionPanel'
import type { AnswerResult } from '../types/api'

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

function setup(over: Partial<QuestionPanelProps> = {}) {
  const props: QuestionPanelProps = {
    question,
    combat: 'question',
    monsterName: 'Slime',
    onAnswer: vi.fn(),
    onNext: vi.fn(),
    onRetreat: vi.fn(),
    keysEnabled: true,
    ...over,
  }
  render(<QuestionPanel {...props} />)
  return props
}

afterEach(cleanup)

describe('QuestionPanel', () => {
  it('number keys 1-4 answer with the matching option', () => {
    const p = setup()
    fireEvent.keyDown(window, { key: '2' })
    expect(p.onAnswer).toHaveBeenCalledWith('Mitochondria')
  })

  it('ignores number keys when keys are disabled', () => {
    const p = setup({ keysEnabled: false })
    fireEvent.keyDown(window, { key: '1' })
    expect(p.onAnswer).not.toHaveBeenCalled()
  })

  it('disables options outside the question state', () => {
    setup({ combat: 'submitting' })
    for (const name of question.options) {
      expect((screen.getByRole('button', { name: new RegExp(`${name}$`) }) as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('shows Retreat only in the question state', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Retreat from battle' })).toBeTruthy()
  })

  it('hides Retreat when not in the question state', () => {
    setup({ combat: 'next', result: result() })
    expect(screen.queryByRole('button', { name: 'Retreat from battle' })).toBeNull()
  })

  it.each(['next', 'monster_defeated', 'player_defeated'] as const)('shows Next in %s', (combat) => {
    setup({ combat, result: result() })
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('does not show Next while answering', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('renders correct feedback with damage dealt and source', () => {
    setup({ combat: 'next', result: result() })
    expect(screen.getByText('Correct!')).toBeTruthy()
    expect(screen.getByText('You dealt 20 damage')).toBeTruthy()
    expect(screen.getByText(/From your notes: page 3/)).toBeTruthy()
  })

  it('renders incorrect feedback with damage received', () => {
    setup({ combat: 'next', result: result({ correct: false, damage_dealt: 0 }), damageReceived: 15 })
    expect(screen.getAllByText(/Incorrect/).length).toBeGreaterThan(0)
    expect(screen.getByText('You took 15 damage')).toBeTruthy()
  })

  it('uses the prompt as the dialog heading', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading').textContent).toBe(question.prompt)
    expect(screen.getByText('Slime blocks your way')).toBeTruthy()
  })
})
