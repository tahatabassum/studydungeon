import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'

const bossRoom = demoDungeon.rooms.find((r) => r.is_boss)!
const bossPool = bossRoom.monster.question_ids

// Feature: frontend-03-phaser-core, Property 11: Boss falls after exactly 6 correct answers
// **Validates: Requirements 6.8, 6.9, 6.10, 6.12**
describe('Property 11: Boss falls after exactly 6 correct answers', () => {
  it('has the expected boss setup', () => {
    expect(bossRoom.monster.max_hp).toBe(120)
    expect(bossPool).toHaveLength(8)
  })

  // 6 correct answers interleaved with k (0..8) wrong answers, in any order.
  const sequenceArb = fc.integer({ min: 0, max: 8 }).chain((k) => {
    const items = [...Array<boolean>(6).fill(true), ...Array<boolean>(k).fill(false)]
    return fc.shuffledSubarray(items, { minLength: items.length, maxLength: items.length })
  })

  it('boss HP = 120 - 20n, hits 0 exactly at 6th correct; wrong costs min(12, hp)', async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArb, async (sequence) => {
        const api = createMockAdapter()
        const run = await api.startRun(demoDungeon.id)
        let playerHp = 100
        let bossHp = 120
        let correctCount = 0

        for (let i = 0; i < sequence.length && bossHp > 0; i++) {
          const questionId = bossPool[i % bossPool.length]
          const isCorrect = sequence[i]
          const result = await api.submitAttempt(run.id, {
            attempt_id: `a-${i}`,
            question_id: questionId,
            selected_answer: isCorrect ? answerKey[questionId].correct : '__wrong__',
          })

          if (isCorrect) {
            correctCount += 1
            bossHp = Math.max(0, 120 - 20 * correctCount)
            expect(result.player_hp_remaining).toBe(playerHp)
            if (correctCount < 6) expect(bossHp).toBeGreaterThan(0)
          } else {
            const damage = Math.min(12, playerHp)
            playerHp -= damage
            expect(result.player_hp_remaining).toBe(playerHp)
          }
          expect(result.monster_hp_remaining).toBe(bossHp)
        }

        expect(correctCount).toBe(6)
        expect(bossHp).toBe(0)
        // Boss is now defeated; room can be cleared.
        await expect(api.clearRoom(run.id, bossRoom.id)).resolves.toEqual({ xp_delta: 100 })
      }),
      { numRuns: 100 },
    )
  })
})
