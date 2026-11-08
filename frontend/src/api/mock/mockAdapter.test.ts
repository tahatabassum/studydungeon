import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { ApiError } from '../errors'
import demoDungeon from '../../demo/demoDungeon.json'
import { answerKey } from './answerKey'
import type { AnswerResult, AttemptRequest } from '../../types/api'

const questions = demoDungeon.questions
const questionIds = questions.map((q) => q.id)
const allOptions = questions.flatMap((q) => q.options)

const answerArb = fc.oneof(fc.constantFrom(...allOptions), fc.string())
const attemptArb = fc.record({
  qIndex: fc.integer({ min: 0, max: questionIds.length - 1 }),
  answer: answerArb,
})

type Outcome = AnswerResult | { status: number }

async function tryAttempt(
  api: ReturnType<typeof createMockAdapter>,
  runId: string,
  req: AttemptRequest,
): Promise<Outcome> {
  try {
    return await api.submitAttempt(runId, req)
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status }
    throw e
  }
}

async function freshRun() {
  const api = createMockAdapter()
  const run = await api.startRun(demoDungeon.id)
  return { api, run }
}

describe('Property 5: Mock attempt results conform to the contract', () => {
  // Feature: frontend-00-playable-slice, Property 5: Mock attempt results conform to the contract
  // **Validates: Requirements 4.5**
  it('returns a well-typed AnswerResult for any question and answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...questionIds),
        answerArb,
        async (questionId, answer) => {
          const { api, run } = await freshRun()
          const r = await api.submitAttempt(run.id, {
            question_id: questionId,
            selected_answer: answer,
            attempt_id: 'a1',
          })
          expect(typeof r.correct).toBe('boolean')
          for (const k of [
            'damage_dealt',
            'monster_hp_remaining',
            'player_hp_remaining',
            'score_delta',
            'xp_delta',
            'streak',
          ] as const) {
            expect(typeof r[k]).toBe('number')
          }
          expect(r.player_hp_remaining).toBeGreaterThanOrEqual(0)
          expect(r.player_hp_remaining).toBeLessThanOrEqual(100)
          expect(r.monster_hp_remaining).toBeGreaterThanOrEqual(0)
          expect(r.monster_hp_remaining).toBeLessThanOrEqual(120)
          expect(['due', 'not_due']).toContain(r.review_status)
          expect(typeof r.source.page).toBe('number')
          expect(typeof r.source.chunk_id).toBe('string')
          expect(['undefined', 'string']).toContain(typeof r.explanation)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 6: Attempt idempotence', () => {
  // Feature: frontend-00-playable-slice, Property 6: Attempt idempotence
  // **Validates: Requirements 4.6**
  it('re-submitting an attempt_id returns the same result and does not change state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(attemptArb, { minLength: 1, maxLength: 8 }),
        fc.nat(),
        attemptArb,
        async (attempts, dupSeed, probe) => {
          const reqs: AttemptRequest[] = attempts.map((a, i) => ({
            question_id: questionIds[a.qIndex],
            selected_answer: a.answer,
            attempt_id: `a${i}`,
          }))
          const dup = dupSeed % reqs.length
          const probeReq: AttemptRequest = {
            question_id: questionIds[probe.qIndex],
            selected_answer: probe.answer,
            attempt_id: 'probe',
          }

          const plain = await freshRun()
          const withDup = await freshRun()

          const plainResults: Outcome[] = []
          for (const r of reqs) plainResults.push(await tryAttempt(plain.api, plain.run.id, r))

          const dupResults: Outcome[] = []
          for (let i = 0; i < reqs.length; i++) {
            dupResults.push(await tryAttempt(withDup.api, withDup.run.id, reqs[i]))
            if (i === dup) {
              const again = await tryAttempt(withDup.api, withDup.run.id, reqs[i])
              expect(again).toEqual(dupResults[i])
            }
          }
          expect(dupResults).toEqual(plainResults)

          const a = await tryAttempt(plain.api, plain.run.id, probeReq)
          const b = await tryAttempt(withDup.api, withDup.run.id, probeReq)
          expect(b).toEqual(a)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('mock adapter unit tests', () => {
  it('startDemoSession returns a guest session with future ISO expiry', async () => {
    const api = createMockAdapter()
    const s = await api.startDemoSession()
    expect(s.user.is_guest).toBe(true)
    expect(s.dungeon_id).toBe('demo-dungeon')
    const t = Date.parse(s.expires_at)
    expect(Number.isNaN(t)).toBe(false)
    expect(new Date(t).toISOString()).toBe(s.expires_at)
    expect(t).toBeGreaterThan(Date.now())
  })

  it('getDungeon returns the demo dungeon without answers; unknown id is 404', async () => {
    const api = createMockAdapter()
    const d = await api.getDungeon('demo-dungeon')
    expect(JSON.stringify(d)).not.toContain('correct')
    await expect(api.getDungeon('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('unknown run id rejects with a 404 ApiError', async () => {
    const api = createMockAdapter()
    const p = api.submitAttempt('missing', {
      question_id: 'q1',
      selected_answer: 'CPU',
      attempt_id: 'x',
    })
    await expect(p).rejects.toBeInstanceOf(ApiError)
    await expect(p).rejects.toMatchObject({ status: 404 })
    await expect(api.clearRoom('missing', 'room-1')).rejects.toMatchObject({ status: 404 })
  })

  it('clearRoom is 409 while the monster is alive and grants 25 xp after defeat', async () => {
    const { api, run } = await freshRun()
    await expect(api.clearRoom(run.id, 'room-1')).rejects.toMatchObject({ status: 409 })
    for (let i = 0; i < 3; i++) {
      await api.submitAttempt(run.id, {
        question_id: 'q1',
        selected_answer: 'CPU',
        attempt_id: `c${i}`,
      })
    }
    await expect(api.clearRoom(run.id, 'room-1')).resolves.toEqual({ xp_delta: 25 })
  })

  it('startRun begins in the first room with full player and room-1 monster HP', async () => {
    const { run } = await freshRun()
    expect(run.player_hp).toBe(100)
    expect(run.monster_hp).toBe(60)
    expect((run as { current_room_id?: string }).current_room_id).toBe('room-1')
  })

  it('clearRoom is idempotent: same xp_delta, no double counting in the summary', async () => {
    const { api, run } = await freshRun()
    await killRoom(api, run.id, 'room-1')
    const first = await api.clearRoom(run.id, 'room-1')
    const second = await api.clearRoom(run.id, 'room-1')
    expect(second).toEqual(first)
  })
})

async function answer(
  api: ReturnType<typeof createMockAdapter>,
  runId: string,
  qid: string,
  ok: boolean,
  tag: string,
) {
  return api.submitAttempt(runId, {
    question_id: qid,
    selected_answer: ok ? answerKey[qid].correct : '__wrong__',
    attempt_id: tag,
  })
}

async function killRoom(api: ReturnType<typeof createMockAdapter>, runId: string, roomId: string) {
  const room = demoDungeon.rooms.find((r) => r.id === roomId)!
  const ids = room.monster.question_ids
  let i = 0
  const hits = Math.ceil(room.monster.max_hp / 20)
  for (; i < hits; i++) await answer(api, runId, ids[i % ids.length], true, `${roomId}-k${i}`)
}

describe('multi-room mock behaviour', () => {
  it('attempts change only the owning room monster and keep player HP run-wide', async () => {
    const { api, run } = await freshRun()
    await answer(api, run.id, 'q1', false, 'w1')
    const r = await answer(api, run.id, 'm1', true, 'c1')
    expect(r.player_hp_remaining).toBe(90)
    expect(r.monster_hp_remaining).toBe(40)
    const r2 = await answer(api, run.id, 'q1', true, 'c2')
    expect(r2.monster_hp_remaining).toBe(40)
  })

  it('rejects attempts on a defeated monster with 409', async () => {
    const { api, run } = await freshRun()
    await killRoom(api, run.id, 'room-1')
    await expect(answer(api, run.id, 'q1', true, 'late')).rejects.toMatchObject({ status: 409 })
  })

  it('clearRoom awards 25 for topic rooms and 100 for the boss; 409 while alive', async () => {
    const { api, run } = await freshRun()
    await expect(api.clearRoom(run.id, 'room-5')).rejects.toMatchObject({ status: 409 })
    await expect(api.clearRoom(run.id, 'nope')).rejects.toMatchObject({ status: 404 })
    await killRoom(api, run.id, 'room-2')
    await expect(api.clearRoom(run.id, 'room-2')).resolves.toEqual({ xp_delta: 25 })
    await killRoom(api, run.id, 'room-5')
    await expect(api.clearRoom(run.id, 'room-5')).resolves.toEqual({ xp_delta: 100 })
  })

  it('finishRun is 409 before the boss is cleared, then returns a stable summary', async () => {
    const { api, run } = await freshRun()
    await expect(api.finishRun(run.id)).rejects.toMatchObject({ status: 409 })
    await answer(api, run.id, 'b1', false, 'bw')
    for (let i = 0; i < 6; i++) {
      const r = await answer(api, run.id, `b${(i % 8) + 1}`, true, `bc${i}`)
      if (i < 5) expect(r.monster_hp_remaining).toBeGreaterThan(0)
      else expect(r.monster_hp_remaining).toBe(0)
    }
    await api.clearRoom(run.id, 'room-5')
    const s = await api.finishRun(run.id)
    expect(s).toMatchObject({ correct: 6, total: 7, score: 600, xp: 160 })
    expect(s.accuracy).toBeCloseTo(6 / 7)
    await expect(api.finishRun(run.id)).resolves.toEqual(s)
  })

  it('boss at full 120 HP: 5 correct answers leave it alive, the 6th brings it to 0', async () => {
    const { api, run } = await freshRun()
    const hp: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await answer(api, run.id, `b${i + 1}`, true, `bf${i}`)
      hp.push(r.monster_hp_remaining)
    }
    expect(hp).toEqual([100, 80, 60, 40, 20, 0])
  })

  it('full dungeon playthrough ends in a consistent run summary', async () => {
    const { api, run } = await freshRun()
    const rooms = [...demoDungeon.rooms].sort((a, b) => a.order - b.order)
    let hits = 0
    for (const room of rooms) {
      await killRoom(api, run.id, room.id)
      hits += Math.ceil(room.monster.max_hp / 20)
      await api.clearRoom(run.id, room.id)
    }
    const s = await api.finishRun(run.id)
    expect(s).toMatchObject({ correct: hits, total: hits, xp: hits * 10 + 4 * 25 + 100 })
    expect(s.accuracy).toBe(1)
  })

  it('getProgress starts at level 1 with 100 xp to next, grows after a room clear, levels up at >=100 xp', async () => {
    const { api, run } = await freshRun()
    await expect(api.getProgress()).resolves.toMatchObject({ level: 1, total_xp: 0, xp_to_next: 100 })
    await killRoom(api, run.id, 'room-1')
    await api.clearRoom(run.id, 'room-1')
    const p1 = await api.getProgress()
    expect(p1.total_xp).toBeGreaterThan(0)
    expect(p1.level).toBe(1)
    expect(p1.xp_to_next).toBe(100 - p1.total_xp)
    for (const id of ['room-2', 'room-3', 'room-4']) {
      await killRoom(api, run.id, id)
      await api.clearRoom(run.id, id)
    }
    const p2 = await api.getProgress()
    expect(p2.total_xp).toBeGreaterThanOrEqual(100)
    expect(p2.level).toBeGreaterThanOrEqual(2)
    expect(p2.xp_to_next).toBeGreaterThan(0)
  })

  it('boss wrong answers cost 12 player HP', async () => {
    const { api, run } = await freshRun()
    const r = await answer(api, run.id, 'b1', false, 'bw')
    expect(r.player_hp_remaining).toBe(88)
  })
})