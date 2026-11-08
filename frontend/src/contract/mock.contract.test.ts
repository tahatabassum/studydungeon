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

describe('contract: Mock_Adapter real balance (C12, C13)', () => {
  async function setup(level?: number) {
    const api = createMockAdapter({ level })
    const session = await api.startDemoSession()
    const dungeon = await api.getDungeon(session.dungeon_id)
    const run = await api.startRun(dungeon.id)
    const rooms = [...dungeon.rooms].sort((a, b) => a.order - b.order)
    const strike = (qid: string, tag: string) =>
      api.submitAttempt(run.id, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: `${tag}-${qid}` })
    return { api, run, rooms, strike }
  }

  async function playRoom1(level?: number) {
    const { rooms, strike, api } = await setup(level)
    const results = []
    // The first room has 80 HP: 20 + 20 + 30 (critical) + 30 (critical, clamped to the 10 HP left).
    for (const qid of rooms[0].monster.question_ids) {
      // A stronger weapon can finish the monster early; a dead monster refuses more attempts.
      if (results.length > 0 && results[results.length - 1].monster_hp_remaining === 0) break
      results.push(await strike(qid, 'r1'))
    }
    return { api, results }
  }

  it('marks is_critical from the third correct answer in a row and multiplies damage by 1.5', async () => {
    const { results } = await playRoom1()
    expect(results.map((r) => r.is_critical)).toEqual([false, false, true, true])
    expect(results.map((r) => r.damage_dealt)).toEqual([20, 20, 30, 10])
    expect(results[3].monster_hp_remaining).toBe(0)
    for (const r of results) expect(answerResultSchema.safeParse(r).success).toBe(true)
  })

  it('hard questions deal 1.25x damage (boss question b2: 20 -> 25)', async () => {
    const { rooms, strike } = await setup()
    expect(rooms[4].monster.question_ids).toContain('b2')
    const r = await strike('b2', 'hard')
    expect(r.damage_dealt).toBe(25)
    expect(r.is_critical).toBe(false)
  })

  it('uses the real unlock rules: level 3 unlocks the Spectral Hammer (35 damage), level 1 and 2 stay on the dagger', async () => {
    const expected: Record<number, [string, number]> = {
      1: ['rusty_dagger', 20],
      2: ['rusty_dagger', 20],
      3: ['spectral_hammer', 35],
      8: ['spectral_hammer', 35],
    }
    for (const [level, [id, damage]] of Object.entries(expected)) {
      const { results } = await playRoom1(Number(level))
      expect(results[0].weapon_id, `level ${level}`).toBe(id)
      expect(results[0].damage_dealt, `level ${level}`).toBe(damage)
    }
  })

  it('unlocks the Arcane Staff at 100 XP and the Hunter Crossbow after clearing 2 rooms', async () => {
    const { api, rooms, strike, run } = await setup()
    let n = 0
    for (const room of rooms.slice(0, 2)) {
      let hp = room.monster.max_hp
      while (hp > 0) {
        const qid = room.monster.question_ids[n % room.monster.question_ids.length]
        hp = (await strike(qid, `u${n++}`)).monster_hp_remaining
      }
      await api.clearRoom(run.id, room.id)
    }
    const p = await api.getProgress()
    expect(p.total_xp).toBeGreaterThanOrEqual(100)
    expect(p.unlocked_weapons).toEqual(expect.arrayContaining(['rusty_dagger', 'arcane_staff', 'hunter_crossbow']))
    expect(p.unlocked_weapons).not.toContain('flame_sigil')
    const next = await strike(rooms[2].monster.question_ids[0], 'next')
    expect(next.weapon_id).toBe('hunter_crossbow')
    // Streak is long by now, so the strike is critical: 30 x 1.5.
    expect(next.is_critical).toBe(true)
    expect(next.damage_dealt).toBe(45)
  })

  it('lists the weapons in progress with their real rules and honours the level override', async () => {
    const api = createMockAdapter({ level: 5 })
    const p = await api.getProgress()
    expect(progressSchema.safeParse(p).success).toBe(true)
    expect(p.level).toBe(5)
    expect(p.xp_to_next).toBeGreaterThan(0)
    expect(p.unlocked_weapons).toEqual(['rusty_dagger', 'spectral_hammer'])
    expect(p.weapons?.map((w) => [w.id, w.unlock_level])).toEqual([
      ['rusty_dagger', 1],
      ['arcane_staff', 6],
      ['hunter_crossbow', 6],
      ['spectral_hammer', 1],
      ['flame_sigil', 6],
    ])
    expect(p.weapons?.map((w) => w.requirement)).toEqual([
      'Always unlocked',
      'Earn 100 XP',
      'Clear 2 rooms',
      'Reach level 3',
      'Defeat a boss',
    ])
  })
})
