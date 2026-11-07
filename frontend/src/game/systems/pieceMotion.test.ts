import { describe, expect, it } from 'vitest'
import { batOffset, clockAngles, gearRad, pendulumDeg } from './pieceMotion'

describe('pieceMotion', () => {
  it('clock is a fixed 10:10 pose under reduced motion', () => {
    const a = clockAngles(0, true)
    const b = clockAngles(123456, true)
    expect(a).toEqual(b)
    expect(a.minute).toBeCloseTo((Math.PI * 2 * 10) / 60)
  })

  it('minute hand completes a turn per minute', () => {
    // 30 s in, outside the stutter window.
    expect(clockAngles(30000 + 4500, false).minute).toBeCloseTo(Math.PI * 2 * (34500 / 60000))
  })

  it('pendulum and gears are static when reduced and bounded otherwise', () => {
    expect(pendulumDeg(777, true)).toBe(0)
    expect(gearRad(5000, true, true)).toBe(0)
    for (let t = 0; t < 5000; t += 100) expect(Math.abs(pendulumDeg(t, false))).toBeLessThanOrEqual(14)
    expect(gearRad(1000, false, true)).toBeGreaterThan(0)
    expect(gearRad(1000, false, false)).toBeLessThan(0)
  })

  it('bat flight returns to its roost', () => {
    expect(batOffset(0).x).toBeCloseTo(0)
    expect(batOffset(1).x).toBeCloseTo(0)
    expect(batOffset(0.5).x).toBeCloseTo(160)
  })
})
