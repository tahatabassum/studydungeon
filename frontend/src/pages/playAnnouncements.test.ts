import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AnswerResult } from '@/types/api'
import { composeAnnouncement, levelMessage, resultAnnouncement, routeAnnouncement, useLevelAnnouncement } from './playAnnouncements'

const result = (over: Partial<AnswerResult> = {}): AnswerResult => ({
  correct: true,
  damage_dealt: 37,
  monster_hp_remaining: 10,
  player_hp_remaining: 80,
  score_delta: 10,
  xp_delta: 5,
  streak: 1,
  source: { page: 3, chunk_id: 'c1' },
  review_status: 'not_due',
  ...over,
})

describe('play announcements', () => {
  it('reads server damage as received and is empty without a visible result', () => {
    expect(resultAnnouncement({ combat: 'result', result: result() })).toBe('Correct. You dealt 37 damage.')
    expect(resultAnnouncement({ combat: 'question', result: result() })).toBe('')
    expect(resultAnnouncement({ combat: 'result', result: null })).toBe('')
  })

  it('announces a miss with damage taken, low health and the memory scroll once it opens', () => {
    const wrong = result({ correct: false, correct_answer: 'Mitochondria' })
    const early = resultAnnouncement({ combat: 'result', result: wrong, damageReceived: 15, lowHealth: true })
    expect(early).toBe('Incorrect. You took 15 damage. Low health.')
    const later = resultAnnouncement({ combat: 'next', result: wrong, damageReceived: 15 })
    expect(later).toContain('The correct answer is Mitochondria.')
  })

  it('uses the revenant wording and joins only the non-empty parts', () => {
    expect(composeAnnouncement({ combat: 'next', result: result(), isRevenant: true, level: 'Level up. You are now level 3.' })).toBe(
      'Correct. Memory laid to rest. Level up. You are now level 3.',
    )
    expect(composeAnnouncement({ combat: null, result: null })).toBe('')
  })

  it('announces a level only when it rises, and drops it when asked to expire', () => {
    expect(levelMessage(2, 3)).toBe('Level up. You are now level 3.')
    expect(levelMessage(3, 3)).toBe('')
    expect(levelMessage(undefined, 1)).toBe('')
    const { result: r, rerender } = renderHook(({ level, expire }) => useLevelAnnouncement(level, expire), {
      initialProps: { level: 2 as number | undefined, expire: false },
    })
    expect(r.current).toBe('')
    act(() => rerender({ level: 3, expire: false }))
    expect(r.current).toBe('Level up. You are now level 3.')
    act(() => rerender({ level: 3, expire: true }))
    expect(r.current).toBe('')
  })

  it('routes the text to exactly one region: the dialog while it is open, otherwise the shell', () => {
    expect(routeAnnouncement('Correct. You dealt 20 damage.', true)).toEqual({ dialog: 'Correct. You dealt 20 damage.', shell: '' })
    expect(routeAnnouncement('Room cleared! +25 XP. The gate opens.', false)).toEqual({ dialog: '', shell: 'Room cleared! +25 XP. The gate opens.' })
    expect(routeAnnouncement('', true)).toEqual({ dialog: '', shell: '' })
  })})
