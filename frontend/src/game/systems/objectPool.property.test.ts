import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ObjectPool } from './objectPool'

type Op = { kind: 'acquire' } | { kind: 'release'; index: number }

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ kind: 'acquire' }),
  fc.nat(20).map<Op>((index) => ({ kind: 'release', index })),
)

describe('ObjectPool', () => {
  // Feature: frontend-04-rpg-ui-combat-flow, Property 15: Pool reuse
  // **Validates: Requirements 18.4**
  it('Property 15: Pool reuse', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.array(opArb, { maxLength: 80 }), (max, ops) => {
        let next = 0
        const pool = new ObjectPool<{ id: number }>({ create: () => ({ id: next++ }), reset: () => {}, max })
        const held: { id: number }[] = []
        const free: { id: number }[] = []
        for (const op of ops) {
          if (op.kind === 'acquire') {
            const freeBefore = free.length
            const o = pool.acquire()
            if (o === null) {
              expect(freeBefore).toBe(0)
              expect(next).toBe(max)
            } else {
              if (freeBefore > 0) expect(free.includes(o)).toBe(true) // reused first
              if (freeBefore > 0) free.splice(free.indexOf(o), 1)
              expect(held.includes(o)).toBe(false) // never handed out twice
              held.push(o)
            }
          } else if (held.length > 0) {
            const [o] = held.splice(op.index % held.length, 1)
            pool.release(o)
            free.push(o)
          }
          expect(next).toBeLessThanOrEqual(max)
          expect(pool.createdCount).toBe(next)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('calls reset on reuse and ignores foreign release', () => {
    let resets = 0
    const pool = new ObjectPool({ create: () => ({}), reset: () => resets++, max: 1 })
    const a = pool.acquire()!
    expect(pool.acquire()).toBeNull()
    pool.release({})
    pool.release(a)
    expect(pool.acquire()).toBe(a)
    expect(resets).toBe(2)
  })
})
