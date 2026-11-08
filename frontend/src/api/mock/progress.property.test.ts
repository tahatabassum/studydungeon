import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'
import type { ProgressInfo } from '../../types/api'

// `progressFromXp` is mock-internal and not exported, so progress is driven through the
// adapter: correct answers and room clears add XP, cumulative across runs.

const rooms = demoDungeon.rooms as unknown as {
  id: string
  order: number
  monster: { max_hp: number; question_ids: string[] }
}[]
const orderedRooms = [...rooms].sort((a, b) => a.order - b.order)

/** Independent reference: total XP needed to reach level n (level n -> n+1 costs 100 * n). */
const threshold = (n: number): number => 50 * n * (n - 1)

type Api = ReturnType<typeof createMockAdapter>

/** Snapshot progress after every XP-changing step of the given plans. */
async function drive(plans: number[][]): Promise<ProgressInfo[]> {
  const api: Api = createMockAdapter()
  const snaps: ProgressInfo[] = [await api.getProgress()]
  let counter = 0
  for (const plan of plans) {
    const run = await api.startRun(demoDungeon.id)
    for (const roomIndex of plan) {
      const room = orderedRooms[roomIndex]
      let hp = room.monster.max_hp
      for (let i = 0; hp > 0 && i < 50; i++) {
        const qid = room.monster.question_ids[i % room.monster.question_ids.length]
        const res = await api.submitAttempt(run.id, {
          question_id: qid,
          selected_answer: answerKey[qid].correct,
          attempt_id: `a${counter++}`,
        })
        hp = res.monster_hp_remaining
        snaps.push(await api.getProgress())
      }
      await api.clearRoom(run.id, room.id)
      snaps.push(await api.getProgress())
    }
  }
  return snaps
}

const planArb = fc.array(
  fc
    .integer({ min: 0, max: orderedRooms.length })
    .map((n) => Array.from({ length: n }, (_, i) => i)),
  { minLength: 1, maxLength: 8 },
)

describe('Property 17: Mock progress is monotonic', () => {
  // Feature: frontend-04-rpg-ui-combat-flow, Property 17: Mock progress is monotonic
  // **Validates: Requirements 20.2**
  it('level never decreases with XP, xp_to_next > 0, level >= 1, thresholds match the formula', async () => {
    await fc.assert(
      fc.asyncProperty(planArb, async (plans) => {
        const snaps = await drive(plans)
        for (const p of snaps) {
          expect(p.level).toBeGreaterThanOrEqual(1)
          expect(p.xp_to_next).toBeGreaterThan(0)
          expect(p.total_xp).toBeGreaterThanOrEqual(0)
          // documented thresholds: level n at [T(n), T(n+1)), xp_to_next = T(level+1) - total
          expect(p.total_xp).toBeGreaterThanOrEqual(threshold(p.level))
          expect(p.total_xp).toBeLessThan(threshold(p.level + 1))
          expect(p.xp_to_next).toBe(threshold(p.level + 1) - p.total_xp)
        }
        // for any two totals a <= b (all pairs), level(a) <= level(b)
        for (let i = 0; i < snaps.length; i++) {
          for (let j = i + 1; j < snaps.length; j++) {
            const [a, b] = [snaps[i], snaps[j]]
            if (a.total_xp <= b.total_xp) expect(a.level).toBeLessThanOrEqual(b.level)
            if (b.total_xp <= a.total_xp) expect(b.level).toBeLessThanOrEqual(a.level)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('starts at level 1 with 0 XP and 100 XP to next', async () => {
    const p = await createMockAdapter().getProgress()
    expect(p).toEqual({ level: 1, total_xp: 0, xp_to_next: 100 })
  })
})
