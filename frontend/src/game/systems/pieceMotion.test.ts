import { describe, expect, it } from 'vitest'
import {
  LIGHTNING_MAX_ALPHA,
  LIGHTNING_MIN_GAP_MS,
  batOffset,
  bobY,
  clockAngles,
  gearRad,
  ghostAlpha,
  lightningAlpha,
  loopU,
  pageDrift,
  pendulumDeg,
} from './pieceMotion'

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

  it('room pieces hold a fixed pose under reduced motion and stay bounded otherwise', () => {
    expect(bobY(1234, 0.3, true)).toBe(0)
    expect(loopU(1, 1800, 0.25, true)).toBeCloseTo(0.25)
    expect(loopU(99999, 1800, 0.25, true)).toBeCloseTo(0.25)
    expect(ghostAlpha(5, 0.1, true)).toBe(0.55)
    for (let t = 0; t < 10000; t += 137) {
      expect(Math.abs(bobY(t, 0.2, false))).toBeLessThanOrEqual(4)
      const u = loopU(t, 9000, 0.4, false)
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
      const g = ghostAlpha(t, 0.2, false)
      expect(g).toBeGreaterThanOrEqual(0.4)
      expect(g).toBeLessThanOrEqual(0.65)
    }
    expect(pageDrift(0.5).y).toBeCloseTo(15)
  })

  it('lightning is soft: alpha never above 0.25, zero outside the strike, two pulses under 400 ms', () => {
    expect(lightningAlpha(-5)).toBe(0)
    expect(lightningAlpha(360)).toBe(0)
    expect(lightningAlpha(150)).toBe(0)
    let peak = 0
    for (let t = 0; t < 400; t++) peak = Math.max(peak, lightningAlpha(t))
    expect(peak).toBeLessThanOrEqual(LIGHTNING_MAX_ALPHA)
    expect(peak).toBeGreaterThan(0.2)
    expect(LIGHTNING_MIN_GAP_MS).toBeGreaterThanOrEqual(8000)
  })

  it('bat flight returns to its roost', () => {
    expect(batOffset(0).x).toBeCloseTo(0)
    expect(batOffset(1).x).toBeCloseTo(0)
    expect(batOffset(0.5).x).toBeCloseTo(160)
  })
})
