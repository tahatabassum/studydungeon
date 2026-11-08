import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { INTERACTION_RANGE, isWithinRange, shouldEngage } from './interaction'
import type { GamePhase } from '../events'

describe('shouldEngage', () => {
  const full = { phase: 'exploring' as GamePhase, inRange: true, alive: true, pressed: true, armed: true }

  it('is true only in the full condition', () => {
    expect(shouldEngage(full)).toBe(true)
  })

  it.each(['encounter', 'resolving', 'paused', 'cleared', 'defeated', 'victory'] as GamePhase[])(
    'ignores E while phase is %s',
    (phase) => {
      expect(shouldEngage({ ...full, phase })).toBe(false)
    },
  )

  it('is false when not armed, out of range, dead, or not pressed', () => {
    expect(shouldEngage({ ...full, armed: false })).toBe(false)
    expect(shouldEngage({ ...full, inRange: false })).toBe(false)
    expect(shouldEngage({ ...full, alive: false })).toBe(false)
    expect(shouldEngage({ ...full, pressed: false })).toBe(false)
  })
})

describe('isWithinRange', () => {
  it('uses range 64 by default', () => {
    expect(INTERACTION_RANGE).toBe(64)
  })

  it('is true at distance 0 and exactly at the boundary', () => {
    expect(isWithinRange({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true)
    expect(isWithinRange({ x: 0, y: 0 }, { x: 64, y: 0 })).toBe(true)
    expect(isWithinRange({ x: 0, y: 0 }, { x: 0, y: -64 })).toBe(true)
  })

  it('is false just outside the boundary', () => {
    expect(isWithinRange({ x: 0, y: 0 }, { x: 65, y: 0 })).toBe(false)
    expect(isWithinRange({ x: 0, y: 0 }, { x: 46, y: 46 })).toBe(false)
  })

  it('honours a custom range', () => {
    expect(isWithinRange({ x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toBe(false)
    expect(isWithinRange({ x: 0, y: 0 }, { x: 10, y: 0 }, 10)).toBe(true)
  })

  // Feature: frontend-00-playable-slice, Property: range check is symmetric
  it('is symmetric in its two points', () => {
    const pt = fc.record({ x: fc.integer({ min: -2000, max: 2000 }), y: fc.integer({ min: -2000, max: 2000 }) })
    fc.assert(
      fc.property(pt, pt, fc.integer({ min: 0, max: 500 }), (a, b, r) => {
        expect(isWithinRange(a, b, r)).toBe(isWithinRange(b, a, r))
      }),
      { numRuns: 100 },
    )
  })
})
