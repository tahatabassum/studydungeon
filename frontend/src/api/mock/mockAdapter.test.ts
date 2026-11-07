import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { ApiError } from '../errors'
import demoDungeon from '../../demo/demoDungeon.json'
import type { AnswerResult, AttemptRequest } from '../../types/api'

const questions = demoDungeon.questions
const questionIds = questions.map((q) => q.id)
const allOptions = questions.flatMap((q) => q.options)

const answerArb = fc.oneof(fc.constantFrom(...allOptions), fc.string())
const attemptArb = fc.record({
  qIndex: fc.integer({ min: 0, max: questionIds.length - 1 }),
  answer: answerArb,
})

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
          expect(r.monster_hp_remaining).toBeLessThanOrEqual(60)
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

          const plainResults: AnswerResult[] = []
          for (const r of reqs) plainResults.push(await plain.api.submitAttempt(plain.run.id, r))

          const dupResults: AnswerResult[] = []
          for (let i = 0; i < reqs.length; i++) {
            dupResults.push(await withDup.api.submitAttempt(withDup.run.id, reqs[i]))
            if (i === dup) {
              const again = await withDup.api.submitAttempt(withDup.run.id, reqs[i])
              expect(again).toEqual(dupResults[i])
            }
          }
          expect(dupResults).toEqual(plainResults)

          const a = await plain.api.submitAttempt(plain.run.id, probeReq)
          const b = await withDup.api.submitAttempt(withDup.run.id, probeReq)
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
})
