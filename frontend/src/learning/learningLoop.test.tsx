/**
 * Example tests for the learning loop: Memory scroll with and without `correct_answer` (saved-to-Memories line,
 * no retry control), band labels, retry wording from the response, Progress panel blocks hidden when absent,
 * the run reducer keeping no re-ask bookkeeping and the scroll's place in the encounter layout.
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6, 10.1, 10.2, 10.3, 10.4, 14.4, 14.5**
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { intersects, stageLayout } from '@/encounter/stageLayout'
import { initialRunState, runReducer, type RunState } from '@/state/runReducer'
import type { AnswerResult, ProgressInfo } from '@/types/api'
import { MASTERY_BAND_LABEL, masteryBand } from './mastery'
import { MasteryBar } from './MasteryBar'
import { MemoryScroll, SAVED_FOR_REVIEW_OFFLINE, SAVED_TO_MEMORIES, scrollAnnouncement } from './MemoryScroll'
import { hasLearningProgress, ProgressPanel } from './ProgressPanel'
import { retryEffectLabel, retryNote } from './retryRules'
import { layoutWeeks } from './StreakCalendar'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/state/useReducedMotion', () => ({ useReducedMotion: () => rm.reduced }))

import { setApiOverride } from '@/api'
import { EncounterPopup, type EncounterPopupProps } from '@/encounter/EncounterPopup'

const wrong = (over: Partial<AnswerResult> = {}): AnswerResult => ({
  correct: false,
  damage_dealt: 0,
  monster_hp_remaining: 80,
  player_hp_remaining: 90,
  score_delta: 0,
  streak: 0,
  source: { page: 7, chunk_id: 'c7' },
  explanation: 'The ALU does arithmetic.',
  evidence_quote: 'The ALU performs arithmetic and logic.',
  ...over,
})

afterEach(() => {
  cleanup()
  setApiOverride(null)
  rm.reduced = false
})

describe('MemoryScroll', () => {
  it('shows the answer, explanation, quote and page, with Continue focused and the saved line', () => {
    render(<MemoryScroll result={wrong({ correct_answer: 'ALU' })} reduced={false} onContinue={vi.fn()} />)
    expect(screen.getByTestId('scroll-answer').textContent).toContain('ALU')
    expect(screen.getByText('From your notes: page 7')).toBeTruthy()
    expect(screen.getByText('The ALU does arithmetic.')).toBeTruthy()
    expect(screen.getByTestId('scroll-quote').textContent).toContain('The ALU performs arithmetic and logic.')
    expect(screen.getByTestId('scroll-saved').textContent).toBe(SAVED_TO_MEMORIES)
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }))
  })

  it('leaves the answer line out when correct_answer is absent, and falls back to the quote without a page', () => {
    render(<MemoryScroll result={wrong({ source: undefined })} reduced={false} onContinue={vi.fn()} />)
    expect(screen.queryByTestId('scroll-answer')).toBeNull()
    expect(screen.queryByTestId('scroll-quote')).toBeNull()
    expect(screen.getByText(/From your notes: "The ALU performs arithmetic and logic\."/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }))
  })

  it('still opens when the response carries no teaching text', () => {
    render(<MemoryScroll result={wrong({ source: undefined, explanation: undefined, evidence_quote: undefined })} reduced onContinue={vi.fn()} />)
    expect(screen.getByTestId('memory-scroll').getAttribute('data-reduced')).toBe('true')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })

  it('says the question is saved for review, not Memories, in the offline demo', () => {
    setApiOverride({} as never)
    render(<MemoryScroll result={wrong()} reduced={false} onContinue={vi.fn()} />)
    expect(screen.getByTestId('scroll-saved').textContent).toBe(SAVED_FOR_REVIEW_OFFLINE)
    expect(SAVED_FOR_REVIEW_OFFLINE).toBe('Saved for review. Sign in online to keep it in Memories.')
  })

  it('announces politely, built only from the response', () => {
    expect(scrollAnnouncement({ correct_answer: 'ALU', explanation: 'Because.' })).toBe('Memory scroll. The correct answer is ALU. Because.')
    expect(scrollAnnouncement({})).toBe('Memory scroll.')
  })

  it('calls Continue from the keyboard, the only button', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(<MemoryScroll result={wrong()} reduced={false} onContinue={onContinue} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})

describe('the run reducer keeps no re-ask bookkeeping', () => {
  const encounter = (): RunState => {
    let s = runReducer(initialRunState, {
      type: 'run-started',
      run: { id: 'r', dungeon_id: 'd', player_hp: 100, monster_hp: 80, current_room_id: 'a' },
      rooms: [
        { id: 'a', order: 1, monster: { max_hp: 80 } },
        { id: 'b', order: 2, is_boss: true, monster: { max_hp: 90 } },
      ],
    })
    s = runReducer(s, { type: 'encounter-started' })
    s = runReducer(s, { type: 'question-presented' })
    return runReducer(s, { type: 'answer-submitted' })
  }

  it('ignores a requeue_after on the wire: the wrong answer only costs HP and the state has no pending list', () => {
    const missed = runReducer(encounter(), { type: 'result-received', result: wrong({ requeue_after: 3 }), questionId: 'q1' })
    expect(missed).not.toHaveProperty('pendingRequeue')
    expect(missed.playerHp).toBe(90)
    expect(missed.combat).toBe('result')
  })
})
describe('retry wording', () => {
  it('words the multiplier it receives and nothing else', () => {
    expect(retryEffectLabel(0.5)).toBe('half damage')
    expect(retryEffectLabel(1)).toBe('full damage')
    expect(retryEffectLabel(0.25)).toBe('25 percent damage')
    expect(retryNote({ is_retry: true, retry_multiplier: 0.5 })).toBe('Retry: half damage')
    expect(retryNote({ is_retry: true })).toBe('Second chance')
    expect(retryNote({ is_retry: false, retry_multiplier: 0.5 })).toBeNull()
    expect(retryNote({})).toBeNull()
  })
})

describe('mastery band labels', () => {
  it.each([
    [0, 'Weak'],
    [49, 'Weak'],
    [50, 'Learning'],
    [79, 'Learning'],
    [80, 'Strong'],
    [100, 'Strong'],
  ])('%i is %s', (value, label) => {
    expect(MASTERY_BAND_LABEL[masteryBand(value)]).toBe(label)
    render(<MasteryBar value={value} showLabel />)
    expect(screen.getByRole('img', { name: `Mastery ${value} percent, ${label}` })).toBeTruthy()
    expect(screen.getByText(`${label} ${value}`)).toBeTruthy()
  })
})

describe('ProgressPanel', () => {
  const full: ProgressInfo = {
    level: 2,
    total_xp: 120,
    notes_conquered_percent: 40,
    memory_strength: [{ topic_id: 't1', title: 'Hardware', strength: 85 }],
    streak_calendar: Array.from({ length: 84 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
      reviewed: i % 3 === 0,
    })),
    weak_concepts: [{ text: 'What is a register?', page: 4 }],
  }

  it('shows all four blocks when the fields are present', () => {
    render(<ProgressPanel progress={full} />)
    expect(within(screen.getByTestId('notes-conquered')).getByText('40% of your notes')).toBeTruthy()
    expect(within(screen.getByTestId('memory-strength')).getByText('Strong 85%')).toBeTruthy()
    expect(screen.getByRole('table', { name: /last 12 weeks/ })).toBeTruthy()
    expect(within(screen.getByTestId('weakest-concepts')).getByText('From your notes: page 4')).toBeTruthy()
  })

  it('labels every calendar day with a date and whether it was reviewed', () => {
    render(<ProgressPanel progress={full} />)
    const days = screen.getAllByTestId('cal-day')
    expect(days.length).toBeGreaterThan(70)
    expect(days.every((d) => /^\w{3} \d+, (not )?reviewed$/.test(d.textContent ?? ''))).toBe(true)
    expect(layoutWeeks(full.streak_calendar!).length).toBeLessThanOrEqual(12)
  })

  it.each([
    ['notes-conquered', { notes_conquered_percent: undefined }],
    ['memory-strength', { memory_strength: undefined }],
    ['streak-block', { streak_calendar: undefined }],
    ['weakest-concepts', { weak_concepts: undefined }],
  ])('hides %s when its field is absent and keeps the others', (testId, patch) => {
    render(<ProgressPanel progress={{ ...full, ...patch }} />)
    expect(screen.queryByTestId(testId)).toBeNull()
    expect(screen.getAllByTestId(/notes-conquered|memory-strength|streak-block|weakest-concepts/)).toHaveLength(3)
  })

  it('renders nothing at all when no field is present or all are empty', () => {
    const bare: ProgressInfo = { level: 1, total_xp: 0 }
    expect(hasLearningProgress(bare)).toBe(false)
    const { container } = render(<ProgressPanel progress={bare} />)
    expect(container.firstChild).toBeNull()
    cleanup()
    const { container: c2 } = render(<ProgressPanel progress={{ ...bare, memory_strength: [], streak_calendar: [], weak_concepts: [] }} />)
    expect(c2.firstChild).toBeNull()
  })
})

describe('Memory scroll in the encounter layout', () => {
  const question = { id: 'q1', type: 'mcq' as const, prompt: 'What powers the cell?', options: ['A', 'B', 'C', 'D'] }
  const props = (over: Partial<EncounterPopupProps> = {}): EncounterPopupProps => ({
    question,
    combat: 'next',
    monsterName: 'Slime',
    monsterKind: 'toxic_slime',
    isBoss: false,
    roomOrder: 2,
    result: wrong({ correct_answer: 'A' }),
    damageReceived: 10,
    onAnswer: vi.fn(),
    onNext: vi.fn(),
    keysEnabled: true,
    ...over,
  })

  it('sits inside the panel scroller, which keeps clear of the portrait, and replaces the Next button', () => {
    render(<EncounterPopup {...props()} />)
    const scroll = screen.getByTestId('memory-scroll')
    expect(scroll.closest('.sd-speech__scroll')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quick retry/ })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }))
  })

  it('shows the scroll when the player has fallen, and none for a correct answer', () => {
    const { rerender } = render(<EncounterPopup {...props({ combat: 'player_defeated' })} />)
    expect(screen.getByTestId('memory-scroll')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Quick retry/ })).toBeNull()
    rerender(<EncounterPopup {...props({ combat: 'next', result: wrong({ correct: true, damage_dealt: 20 }) })} />)
    expect(screen.queryByTestId('memory-scroll')).toBeNull()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('shows no Second chance tag and no returning whisper on a fresh question', () => {
    render(<EncounterPopup {...props({ combat: 'question', result: null })} />)
    expect(screen.queryByTestId('second-chance-tag')).toBeNull()
    expect(screen.queryByTestId('requeue-notice')).toBeNull()
  })
  // Portrait beside the panel: the content box never meets the portrait box (existing stageLayout math).
  it.each([
    [1024, 635],
    [1366, 768],
    [1920, 1080],
    [390, 844],
  ])('keeps panel content off the portrait at %ix%i', (vw, vh) => {
    for (const side of ['left', 'right'] as const) {
      for (const panelH of [260, Math.round(vh * 0.58)]) {
        const l = stageLayout(vw, vh, side, panelH)
        expect(intersects(l.portrait, l.content), `${side} ${panelH}`).toBe(false)
      }
    }
  })
})
