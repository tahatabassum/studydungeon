import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'

const bossRoom = demoDungeon.rooms.find((r) => r.is_boss)!
const bossPool = bossRoom.monster.question_ids

// Feature: frontend-03-phaser-core, Property 11: The boss falls once the damage dealt adds up to its HP
// (was "exactly 6 correct answers" while the boss had 120 HP and every hit dealt 20; the real balance is
// a 220 HP Exam Warden with weapon, hard-question and critical multipliers, so the number of hits varies).
// **Validates: Requirements 6.8, 6.9, 6.10, 6.12**
describe('Property 11: Boss falls when damage dealt adds up to its HP', () => {
  it('has the expected boss setup', () => {
    expect(bossRoom.monster.max_hp).toBe(220)
    expect(bossPool).toHaveLength(8)
  })

  // Up to 8 wrong answers (96 HP of counter damage at most) mixed into a prefix of answers.
  const opsArb = fc.array(fc.boolean(), { maxLength: 16 }).map((ops) => {
    let wrongs = 0
    return ops.map((ok) => {
      if (ok) return true
      wrongs += 1
      return wrongs > 8
    })
  })

  it('boss HP drops by exactly the damage dealt, never below 0; wrong costs min(12, hp)', async () => {
    await fc.assert(
      fc.asyncProperty(opsArb, async (ops) => {
        const api = createMockAdapter()
        const run = await api.startRun(demoDungeon.id)
        let playerHp = 100
        let bossHp = 220
        let correctCount = 0
        let i = 0

        const step = async (isCorrect: boolean) => {
          const questionId = bossPool[i % bossPool.length]
          const result = await api.submitAttempt(run.id, {
            attempt_id: `a-${i}`,
            question_id: questionId,
            selected_answer: isCorrect ? answerKey[questionId].correct : '__wrong__',
          })
          i += 1
          if (isCorrect) {
            correctCount += 1
            expect(result.damage_dealt).toBeGreaterThan(0)
            bossHp = Math.max(0, bossHp - result.damage_dealt)
            expect(result.player_hp_remaining).toBe(playerHp)
          } else {
            playerHp -= Math.min(12, playerHp)
            expect(result.player_hp_remaining).toBe(playerHp)
          }
          expect(result.monster_hp_remaining).toBe(bossHp)
        }

        for (const ok of ops) {
          if (bossHp <= 0) break
          await step(ok)
        }
        while (bossHp > 0 && i < 80) await step(true)

        // 220 HP cannot fall in fewer than 3 hits (the strongest strike is 40 x 1.25 x 1.5 = 75).
        expect(correctCount).toBeGreaterThanOrEqual(3)
        expect(bossHp).toBe(0)
        // Boss is now defeated; room can be cleared.
        await expect(api.clearRoom(run.id, bossRoom.id)).resolves.toMatchObject({ xp_delta: 100 })
      }),
      { numRuns: 100 },
    )
  })
})
