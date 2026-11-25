/**
 * Question_Selector: the no-re-ask rule and the fallback order.
 * Feature: frontend-14-no-retry-and-predeploy-audit
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import dungeon from '@/demo/demoDungeon.json'
import { pickQuestionId, selectNextQuestion, type SelectInput } from './questionSelector'

const runs = { numRuns: 100 }
const poolArb = fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 12 })
describe('pickQuestionId', () => {
  // Feature: frontend-03-phaser-core, Property 4: Question selection stays in the pool and cycles
  // **Validates: Requirements 5.4, 5.5, 5.6**
  it('stays in the pool, cycles, and covers the whole pool', () => {
    fc.assert(
      fc.property(poolArb, fc.nat({ max: 10_000 }), (pool, n) => {
        const id = pickQuestionId(pool, n)
        expect(id).toBeDefined()
        expect(pool).toContain(id)
        expect(id).toBe(pool[n % pool.length])
        expect(pickQuestionId(pool, n + pool.length)).toBe(id)
        const seen = new Set<string | undefined>()
        for (let i = 0; i < pool.length; i++) seen.add(pickQuestionId(pool, n + i))
        expect(seen.size).toBe(pool.length)
      }),
      runs,
    )
  })
  it('returns undefined for an empty pool', () => {
    expect(pickQuestionId([], 0)).toBeUndefined()
    expect(pickQuestionId([], 5)).toBeUndefined()
  })
  it('treats negative and NaN counts as 0', () => {
    const pool = ['a', 'b', 'c']
    expect(pickQuestionId(pool, -3)).toBe('a')
    expect(pickQuestionId(pool, Number.NaN)).toBe('a')
  })
  it('routes each room only to its own monster pool', () => {
    const pools = dungeon.rooms.map((r) => r.monster.question_ids as string[])
    dungeon.rooms.forEach((_room, k) => {
      const pool = pools[k]
      const others = new Set(pools.filter((_, j) => j !== k).flat())
      const disjoint = pool.every((q) => !others.has(q))
      for (let n = 0; n <= 2 * pool.length; n++) {
        const id = pickQuestionId(pool, n)
        expect(pool).toContain(id)
        if (disjoint) expect(others.has(id as string)).toBe(false)
      }
    })
  })
})

const input = (over: Partial<SelectInput> = {}): SelectInput => ({
  monsterPool: [],
  topicPool: [],
  answered: new Set(),
  missed: new Set(),
  correct: new Set(),
  ...over,
})

describe('selectNextQuestion', () => {
  it('fresh: picks the first unanswered, non-missed monster question', () => {
    const r = selectNextQuestion(
      input({ monsterPool: ['a', 'b', 'c'], topicPool: ['a', 'b', 'c', 'd'], answered: new Set(['a']), missed: new Set(['b']) }),
    )
    expect(r).toEqual({ kind: 'fresh', id: 'c' })
  })

  it('topic: falls back to an unused same-topic question when the monster pool is spent', () => {
    const r = selectNextQuestion(
      input({
        monsterPool: ['a', 'b'],
        topicPool: ['a', 'b', 'x', 'y'],
        answered: new Set(['a', 'b']),
        missed: new Set(['b', 'x']),
        correct: new Set(['a']),
      }),
    )
    expect(r).toEqual({ kind: 'topic', id: 'y' })
  })

  it('recycled: falls back to a correctly answered question', () => {
    const r = selectNextQuestion(
      input({ monsterPool: ['a', 'b'], topicPool: ['a', 'b'], answered: new Set(['a', 'b']), missed: new Set(['b']), correct: new Set(['a']) }),
    )
    expect(r).toEqual({ kind: 'recycled', id: 'a' })
  })

  it('none: only missed questions are left', () => {
    const r = selectNextQuestion(
      input({ monsterPool: ['a', 'b'], topicPool: ['a', 'b'], answered: new Set(['a', 'b']), missed: new Set(['a', 'b']) }),
    )
    expect(r).toEqual({ kind: 'none' })
    expect(selectNextQuestion(input())).toEqual({ kind: 'none' })
  })

  it('recycled picks rotate: two consecutive picks differ when two or more correct ids exist', () => {
    const base = { monsterPool: ['a', 'b', 'c'], topicPool: ['a', 'b', 'c'], answered: new Set(['a', 'b', 'c']), correct: new Set(['a', 'b', 'c']) }
    const asked: string[] = []
    for (let i = 0; i < 7; i += 1) {
      const r = selectNextQuestion(input({ ...base, recentlyAsked: asked }))
      expect(r.kind).toBe('recycled')
      if (r.kind === 'none') return
      if (asked.length > 0) expect(r.id).not.toBe(asked[asked.length - 1])
      asked.push(r.id)
    }
    expect(new Set(asked)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('recycled rotation never returns a missed id', () => {
    const r = selectNextQuestion(
      input({
        monsterPool: ['a', 'b'],
        topicPool: ['a', 'b'],
        answered: new Set(['a', 'b']),
        correct: new Set(['a', 'b']),
        missed: new Set(['b']),
        recentlyAsked: ['a'],
      }),
    )
    expect(r).toEqual({ kind: 'recycled', id: 'a' })
  })
})

// A small id alphabet so pools overlap, wrap and collide with the answered / missed / correct sets.
const idArb: fc.Arbitrary<string> = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h')
const ids = fc.array(idArb, { maxLength: 8 })
const setOf: fc.Arbitrary<Set<string>> = fc.uniqueArray(idArb).map((l) => new Set<string>(l))
const inputArb = fc.record({
  monsterPool: fc.uniqueArray(idArb),
  topicPool: fc.uniqueArray(idArb),
  answered: setOf,
  missed: setOf,
  correct: setOf,
  recentlyAsked: ids,
})

describe('selectNextQuestion properties', () => {
  // Feature: frontend-14-no-retry-and-predeploy-audit, Property 1: A missed question is never selected again
  it('Property 1: never returns a missed id, over repeated selections that wrap the pool', () => {
    fc.assert(
      fc.property(inputArb, fc.integer({ min: 1, max: 20 }), (i, steps) => {
        const asked = [...i.recentlyAsked]
        const answered = new Set(i.answered)
        for (let n = 0; n < steps; n += 1) {
          const r = selectNextQuestion({ ...i, answered, recentlyAsked: asked })
          if (r.kind === 'none') return true
          if (i.missed.has(r.id)) return false
          asked.push(r.id)
          answered.add(r.id)
        }
        return true
      }),
      { numRuns: 200 },
    )
  })

  // Feature: frontend-14-no-retry-and-predeploy-audit, Property 2: Selection fallback order
  it('Property 2: kinds follow fresh, topic, recycled, none; none only when no non-missed candidate exists', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const used = (id: string) => i.answered.has(id) || i.missed.has(id)
        const fresh = i.monsterPool.some((id) => !used(id))
        const topic = i.topicPool.some((id) => !used(id) && !i.correct.has(id))
        const recycled = [...i.monsterPool, ...i.topicPool].some((id) => i.correct.has(id) && !i.missed.has(id))
        const expected = fresh ? 'fresh' : topic ? 'topic' : recycled ? 'recycled' : 'none'
        const r = selectNextQuestion(i)
        expect(r.kind).toBe(expected)
        if (r.kind === 'fresh') expect(i.monsterPool).toContain(r.id)
        if (r.kind === 'topic') expect(i.topicPool).toContain(r.id)
        if (r.kind === 'recycled') expect(i.correct.has(r.id)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
