import fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/ApiClient'
import { createOfflineAdapter } from '@/offline'
import type { Dungeon } from '@/types/api'
import bundle from './demoDungeon.json'

const answers = bundle.answers as Record<string, { correct_option: number }>
const questions = new Map(bundle.questions.map((q) => [q.id, q]))
const correctText = (qid: string): string => questions.get(qid)!.options[answers[qid].correct_option]
const wrongText = (qid: string): string => questions.get(qid)!.options.find((o) => o !== correctText(qid))!
const rooms = [...bundle.rooms].sort((a, b) => a.order - b.order)

const fixedClock = () => 1_700_000_000_000
const counterIds = () => {
  let n = 0
  return (prefix: string) => `${prefix}-${(n += 1)}`
}
const make = (): ApiClient => createOfflineAdapter({ now: fixedClock, nextId: counterIds() })

/** Reference model of the working rules, written from the game rules and independent of src/demo/rules.ts. */
function roundHalfEven(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}
interface Ref {
  player: number
  monster: number
  streak: number
}
function refStep(s: Ref, correct: boolean, boss: boolean, hard: boolean) {
  if (correct) {
    const crit = s.streak >= 2
    let dmg = 20
    if (hard) dmg *= 1.25
    if (crit) dmg *= 1.5
    const dealt = Math.min(roundHalfEven(dmg), s.monster)
    const next = { player: s.player, monster: s.monster - dealt, streak: s.streak + 1 }
    return { next, dealt, crit, score: 100, xp: 10 }
  }
  const taken = Math.min(boss ? 12 : 10, s.player)
  return { next: { player: s.player - taken, monster: s.monster, streak: 0 }, dealt: 0, crit: false, score: 0, xp: 0 }
}

afterEach(() => vi.restoreAllMocks())

// Feature: frontend-07-premium-ux-leaderboard, Property 18: Offline rules conform to the game rules
// **Validates: Requirements 14.5, 1.2**
describe('Property 18: Offline rules conform to the game rules', () => {
  it('every answer in any sequence matches the reference model (damage, HP, streak, score, XP, critical)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: rooms.length - 1 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }),
        async (roomIndex, flips) => {
          const api = make()
          const session = await api.startDemoSession()
          const run = await api.startRun(session.dungeon_id)
          const room = rooms[roomIndex]
          let ref: Ref = { player: 100, monster: room.monster.max_hp, streak: 0 }
          let n = 0
          for (const correct of flips) {
            if (ref.monster <= 0 || ref.player <= 0) break
            const qid = room.monster.question_ids[n % room.monster.question_ids.length]
            const hard = questions.get(qid)!.difficulty === 'hard'
            const expected = refStep(ref, correct, room.is_boss, hard)
            const got = await api.submitAttempt(run.id, {
              question_id: qid,
              selected_answer: correct ? correctText(qid) : wrongText(qid),
              attempt_id: `a-${n}`,
            })
            n += 1
            ref = expected.next
            expect(got.correct).toBe(correct)
            expect(got.damage_dealt).toBe(expected.dealt)
            expect(got.monster_hp_remaining).toBe(expected.next.monster)
            expect(got.player_hp_remaining).toBe(expected.next.player)
            expect(got.streak).toBe(expected.next.streak)
            expect(got.score_delta).toBe(expected.score)
            expect(got.xp_delta).toBe(expected.xp)
            expect(got.is_critical).toBe(expected.crit)
            if (!correct) expect(got.damage_dealt).toBe(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('a wrong answer never hurts the monster and a correct one never hurts the player', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }), async (flips) => {
        const api = make()
        const run = await api.startRun((await api.startDemoSession()).dungeon_id)
        const room = rooms[0]
        let monster = room.monster.max_hp
        let player = 100
        for (const [i, correct] of flips.entries()) {
          if (monster <= 0 || player <= 0) break
          const qid = room.monster.question_ids[i % room.monster.question_ids.length]
          const r = await api.submitAttempt(run.id, {
            question_id: qid,
            selected_answer: correct ? correctText(qid) : wrongText(qid),
            attempt_id: `b-${i}`,
          })
          if (correct) expect(r.player_hp_remaining).toBe(player)
          else expect(r.monster_hp_remaining).toBe(monster)
          monster = r.monster_hp_remaining
          player = r.player_hp_remaining
        }
      }),
      { numRuns: 50 },
    )
  })
})

/** Plays floor 1 with a scripted sequence of right/wrong answers and records every response. */
async function playFloorOne(api: ApiClient, flips: boolean[]): Promise<unknown[]> {
  const log: unknown[] = []
  const session = await api.startDemoSession()
  const dungeon: Dungeon = await api.getDungeon(session.dungeon_id)
  log.push(session, dungeon)
  const floor = dungeon.floors![0]
  const run = await api.startRun({ dungeon_id: dungeon.id, floor_id: floor.id, mode: 'floor' })
  log.push(run)
  let n = 0
  let dead = false
  for (const roomId of floor.room_ids) {
    const room = dungeon.rooms.find((r) => r.id === roomId)!
    let hp = room.monster.max_hp
    while (hp > 0 && !dead && n < 200) {
      const qid = room.monster.question_ids[n % room.monster.question_ids.length]
      // After the script ends every answer is right, so every run can finish.
      const correct = n < flips.length ? flips[n] : true
      const res = await api.submitAttempt(run.id, {
        question_id: qid,
        selected_answer: correct ? correctText(qid) : wrongText(qid),
        attempt_id: `d-${n}`,
      })
      n += 1
      log.push(res)
      hp = res.monster_hp_remaining
      if (res.player_hp_remaining <= 0) dead = true
    }
    if (dead) break
    log.push(await api.clearRoom(run.id, room.id))
  }
  if (!dead) {
    log.push(await api.finishRun(run.id))
    log.push(await api.getProgress(), await api.getGenerationStatus(dungeon.id), await api.getLeaderboard({ dungeonId: dungeon.id, period: 'all' }))
  }
  return log
}

// Feature: frontend-07-premium-ux-leaderboard, Property 19: Offline determinism
// **Validates: Requirements 14.5, 1.2**
describe('Property 19: Offline determinism', () => {
  it('the same answer sequence with the same clock and ids gives byte-identical results, with no randomness', async () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used offline')
    })
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { maxLength: 30 }), async (flips) => {
        const first = await playFloorOne(make(), flips)
        const second = await playFloorOne(make(), flips)
        expect(JSON.stringify(second)).toBe(JSON.stringify(first))
      }),
      { numRuns: 60 },
    )
    expect(random).not.toHaveBeenCalled()
  })

  it('a different clock changes only timestamps, never an outcome', async () => {
    const script = [true, false, true, true, false, true]
    const a = createOfflineAdapter({ now: () => 1_000, nextId: counterIds() })
    const b = createOfflineAdapter({ now: () => 9_999_000, nextId: counterIds() })
    const strip = (log: unknown[]) =>
      JSON.stringify(log).replace(/"(expires_at|finished_at|updated_at)":"[^"]*"/g, '"$1":"-"')
    expect(strip(await playFloorOne(b, script))).toBe(strip(await playFloorOne(a, script)))
  })
})
