import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { movementVector } from './movementVector'

const input = fc.record({
  up: fc.boolean(),
  down: fc.boolean(),
  left: fc.boolean(),
  right: fc.boolean(),
})

describe('movementVector', () => {
  // Feature: frontend-00-playable-slice, Movement vector: length 0 or 1, opposite keys cancel
  // Validates: Requirements 8.1, 8.2
  it('always has length 0 or 1', () => {
    fc.assert(
      fc.property(input, (i) => {
        const v = movementVector(i)
        const len = Math.hypot(v.x, v.y)
        expect(Math.abs(len) < 1e-9 || Math.abs(len - 1) < 1e-9).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('cancels opposite keys per axis', () => {
    fc.assert(
      fc.property(input, (i) => {
        const v = movementVector(i)
        if (i.left === i.right) expect(v.x).toBe(0)
        if (i.up === i.down) expect(v.y).toBe(0)
      }),
      { numRuns: 100 },
    )
  })

  it('normalizes diagonals', () => {
    const v = movementVector({ up: true, down: false, left: false, right: true })
    expect(v.x).toBeCloseTo(Math.SQRT1_2)
    expect(v.y).toBeCloseTo(-Math.SQRT1_2)
  })
})
