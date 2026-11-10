import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DEAD_ZONE, clampToRadius, joystickVector, sameVector } from './joystickMath'
import { combineMovement } from '../game/systems/movementVector'

const R = 50

describe('joystickVector', () => {
  it('is (0, 0) inside the dead zone and at the centre', () => {
    expect(joystickVector(0, 0, R)).toEqual({ x: 0, y: 0 })
    expect(joystickVector(R * DEAD_ZONE * 0.9, 0, R)).toEqual({ x: 0, y: 0 })
    expect(joystickVector(0, -R * DEAD_ZONE, R)).toEqual({ x: 0, y: 0 })
  })

  it('points the way the thumb points and reaches length 1 at the rim', () => {
    expect(joystickVector(R, 0, R)).toEqual({ x: 1, y: 0 })
    expect(joystickVector(0, -R, R)).toEqual({ x: 0, y: -1 })
    const diag = joystickVector(R, R, R)
    expect(diag.x).toBeCloseTo(Math.SQRT1_2, 1)
    expect(diag.y).toBeCloseTo(Math.SQRT1_2, 1)
  })

  it('clamps beyond the rim and grows smoothly between the dead zone and the rim', () => {
    expect(joystickVector(R * 5, 0, R)).toEqual({ x: 1, y: 0 })
    const half = joystickVector(R * 0.6, 0, R)
    expect(half.x).toBeGreaterThan(0.3)
    expect(half.x).toBeLessThan(0.8)
  })

  it('returns zero for bad input', () => {
    expect(joystickVector(Number.NaN, 3, R)).toEqual({ x: 0, y: 0 })
    expect(joystickVector(10, 10, 0)).toEqual({ x: 0, y: 0 })
  })

  it('property: always finite, length at most 1, in the direction of the offset', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), fc.integer({ min: -500, max: 500 }), (dx, dy) => {
        const v = joystickVector(dx, dy, R)
        expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true)
        expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1 + 1e-9)
        // Never pointing against the thumb.
        expect(v.x * dx + v.y * dy).toBeGreaterThanOrEqual(0)
        if (Math.hypot(dx, dy) <= R * DEAD_ZONE) expect(v).toEqual({ x: 0, y: 0 })
      }),
    )
  })

  it('sameVector and clampToRadius', () => {
    expect(sameVector({ x: 0.5, y: 0 }, { x: 0.5, y: 0 })).toBe(true)
    expect(sameVector({ x: 0.5, y: 0 }, { x: 0.55, y: 0 })).toBe(false)
    const c = clampToRadius(300, 400, 50)
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(50)
    expect(clampToRadius(3, 4, 50)).toEqual({ x: 3, y: 4 })
  })
})

describe('combineMovement (keyboard wins, otherwise the stick)', () => {
  const out = { x: 0, y: 0 }
  it('uses the keyboard when a key is down', () => {
    expect(combineMovement(1, 0, -1, 0, out)).toEqual({ x: 1, y: 0 })
  })
  it('uses the stick when no key is down, clamped to length 1 (same top speed as the keyboard)', () => {
    expect(combineMovement(0, 0, 0.5, -0.25, out)).toEqual({ x: 0.5, y: -0.25 })
    const c = combineMovement(0, 0, 3, 4, out)
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(1)
  })
  it('is still when neither is active or the stick value is not finite', () => {
    expect(combineMovement(0, 0, 0, 0, out)).toEqual({ x: 0, y: 0 })
    expect(combineMovement(0, 0, Number.NaN, 1, out)).toEqual({ x: 0, y: 1 })
  })
})
