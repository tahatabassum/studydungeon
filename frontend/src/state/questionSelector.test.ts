import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import dungeon from '@/demo/demoDungeon.json'
import { pickQuestionId } from './questionSelector'

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
