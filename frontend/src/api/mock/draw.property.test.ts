import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { drawQuestions } from '../../learning/draw'
import { MAX_POOL, MIN_POOL, syntheticPool } from './pool'
import { buildQueue, MAX_RETURNS, onAnswer, presentedOrder } from '../../learning/requeue'

const poolArb = fc
  .tuple(fc.string({ minLength: 1, maxLength: 8 }), fc.integer({ min: MIN_POOL, max: MAX_POOL }))
  .map(([topic, size]) => syntheticPool(topic, topic, size))

describe('seeded draw', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 4: Seeded draw is deterministic, bounded and repeat-free
  // **Validates: Requirements 3.2, 3.3, 3.4**
  it('Property 4: draws 6 to 8 distinct pool questions, the same every time for a seed', () => {
    fc.assert(
      fc.property(poolArb, fc.string({ maxLength: 24 }), (pool, seed) => {
        const a = drawQuestions(pool, seed)
        const b = drawQuestions(pool, seed)
        expect(a).toEqual(b)
        expect(a.length).toBeGreaterThanOrEqual(6)
        expect(a.length).toBeLessThanOrEqual(8)
        const ids = a.map((q) => q.id)
        expect(new Set(ids).size).toBe(ids.length)
        const poolIds = new Set(pool.map((q) => q.id))
        for (const id of ids) expect(poolIds.has(id)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('limits the draw to a small pool and leaves the pool untouched', () => {
    const pool = syntheticPool('t', 'T', 4)
    const copy = [...pool]
    expect(drawQuestions(pool, 'x')).toHaveLength(4)
    expect(pool).toEqual(copy)
  })
})

describe('requeue', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 5: Requeue never loses or duplicates a question
  // **Validates: Requirements 3.5, 3.6**
  it('Property 5: each question is presented once plus its returns (at most 2); the queue empties', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 60 }),
        (nums, script) => {
          const drawn = nums.map((n) => `q${n}`)
          let step = 0
          const order = presentedOrder(drawn, () => script[step++ % script.length])
          const counts = new Map<string, number>()
          for (const id of order) counts.set(id, (counts.get(id) ?? 0) + 1)
          for (const id of drawn) {
            const c = counts.get(id) ?? 0
            expect(c).toBeGreaterThanOrEqual(1)
            expect(c).toBeLessThanOrEqual(1 + MAX_RETURNS)
          }
          for (const id of counts.keys()) expect(drawn).toContain(id)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('a wrong answer returns the question after 3 further questions, or at the end', () => {
    const s = buildQueue(['a', 'b', 'c', 'd', 'e'])
    const r = onAnswer(s, 'a', false)
    expect(r.requeueAfter).toBe(3)
    expect(r.state.queue).toEqual(['b', 'c', 'd', 'a', 'e'])
    const short = onAnswer(buildQueue(['a', 'b']), 'a', false)
    expect(short.requeueAfter).toBe(1)
    expect(short.state.queue).toEqual(['b', 'a'])
    const last = onAnswer(buildQueue(['a']), 'a', false)
    expect(last.requeueAfter).toBe(0)
    expect(onAnswer(buildQueue(['a', 'b']), 'a', true).requeueAfter).toBeNull()
  })

  it('stops returning a question after two returns', () => {
    let state = buildQueue(['a', 'b'])
    const gaps: Array<number | null> = []
    for (let i = 0; i < 3; i += 1) {
      const out = onAnswer(state, 'a', false)
      gaps.push(out.requeueAfter)
      state = out.state
      // bring 'a' back to the front for the next miss
      state = { ...state, queue: ['a', ...state.queue.filter((q) => q !== 'a')] }
    }
    expect(gaps).toEqual([1, 1, null])
  })
})
