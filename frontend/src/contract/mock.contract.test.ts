import { describe, expect, it } from 'vitest'
import { answerKey } from '../api/mock/answerKey'
import { createMockAdapter } from '../api/mock/mockAdapter'
import { answerResultSchema, progressSchema } from '../api/schemas'
import { defineContractSuite } from './suite'

defineContractSuite({
  label: 'Mock_Adapter',
  makeClient: () => createMockAdapter(),
  correctAnswer: (qid) => answerKey[qid]?.correct,
})

describe('contract: Mock_Adapter weapon_id and is_critical (PROPOSED)', () => {
  async function playRoom1(level?: number) {
    const api = createMockAdapter({ level })
    const session = await api.startDemoSession()
    const dungeon = await api.getDungeon(session.dungeon_id)
    const run = await api.startRun(dungeon.id)
    const room = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0]
    const results = []
    // A 60 HP monster dies on the third correct answer (20 damage each).
    for (const qid of room.monster.question_ids.slice(0, 3)) {
      results.push(
        await api.submitAttempt(run.id, {
          question_id: qid,
          selected_answer: answerKey[qid].correct,
          attempt_id: `crit-${qid}`,
        }),
      )
    }
    return { api, results }
  }

  it('marks is_critical on the third correct answer in a row without changing damage', async () => {
    const { results } = await playRoom1()
    expect(results.map((r) => r.is_critical)).toEqual([false, false, true])
    for (const r of results) {
      expect(answerResultSchema.safeParse(r).success).toBe(true)
      expect(r.damage_dealt).toBe(20)
    }
  })

  it('unlocks weapons by level: dagger L1, staff L2, crossbow L3, hammer L5, sigil L8', async () => {
    const expected: Record<number, string> = {
      1: 'rusty_dagger',
      2: 'arcane_staff',
      3: 'hunter_crossbow',
      4: 'hunter_crossbow',
      5: 'spectral_hammer',
      7: 'spectral_hammer',
      8: 'flame_sigil',
    }
    for (const [level, id] of Object.entries(expected)) {
      const { results } = await playRoom1(Number(level))
      expect(results[0].weapon_id, `level ${level}`).toBe(id)
    }
  })

  it('lists the weapons with unlock levels in progress and honours the level override', async () => {
    const api = createMockAdapter({ level: 5 })
    const p = await api.getProgress()
    expect(progressSchema.safeParse(p).success).toBe(true)
    expect(p.level).toBe(5)
    expect(p.weapons?.map((w) => [w.id, w.unlock_level])).toEqual([
      ['rusty_dagger', 1],
      ['arcane_staff', 2],
      ['hunter_crossbow', 3],
      ['spectral_hammer', 5],
      ['flame_sigil', 8],
    ])
  })
})
