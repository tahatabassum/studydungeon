/** Pure motion math for animated pieces. Angles are radians; all functions allocation-light. */

const TAU = Math.PI * 2
const STUTTER_PERIOD_MS = 9000
const STUTTER_MS = 400

export interface ClockAngles {
  hour: number
  minute: number
}

/**
 * Clock hand angles (clockwise from 12 o'clock). The minute hand turns once per 60 s, the hour
 * hand once per 12 min, and the minute hand occasionally stutters back for 400 ms.
 * Reduced motion returns a fixed 10:10 pose.
 */
export function clockAngles(timeMs: number, reduced: boolean, out: ClockAngles = { hour: 0, minute: 0 }): ClockAngles {
  if (reduced) {
    out.hour = (TAU * (10 + 10 / 60)) / 12
    out.minute = (TAU * 10) / 60
    return out
  }
  const p = timeMs % STUTTER_PERIOD_MS
  const back = p < STUTTER_MS ? 0.25 * Math.sin((Math.PI * p) / STUTTER_MS) : 0
  out.minute = TAU * ((timeMs % 60000) / 60000) - back
  out.hour = TAU * ((timeMs % 720000) / 720000)
  return out
}

/** Pendulum swing angle in degrees: plus or minus 14 on a 2.4 s period; 0 when reduced. */
export function pendulumDeg(timeMs: number, reduced: boolean): number {
  return reduced ? 0 : 14 * Math.sin((TAU * timeMs) / 2400)
}

/** Gear rotation in radians: large turns 8 deg/s, small turns 14 deg/s the other way; 0 when reduced. */
export function gearRad(timeMs: number, reduced: boolean, large: boolean): number {
  if (reduced) return 0
  const degPerSec = large ? 8 : -14
  return ((degPerSec * timeMs) / 1000) * (Math.PI / 180)
}

/** Bat flight offset for progress u in [0, 1]: out 160 px and back; (0, 0) at both ends. */
export function batOffset(u: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
  const s = Math.sin(Math.PI * Math.min(Math.max(u, 0), 1))
  out.x = 160 * s
  out.y = 40 * s
  return out
}

/** Vertical bob in px for a floating piece: plus or minus 4 on a 2.2 s period; 0 when reduced. */
export function bobY(timeMs: number, phase: number, reduced: boolean): number {
  return reduced ? 0 : 4 * Math.sin((TAU * timeMs) / 2200 + phase * TAU)
}

/** Progress 0..1 around a loop of `periodMs`; fixed at `phase` when reduced. */
export function loopU(timeMs: number, periodMs: number, phase: number, reduced: boolean): number {
  if (reduced) return phase - Math.floor(phase)
  const u = timeMs / periodMs + phase
  return u - Math.floor(u)
}

/** Drifting page offset for loop progress u: slow fall with sideways sway and a tilt (radians). */
export function pageDrift(u: number, out: { x: number; y: number; rot: number } = { x: 0, y: 0, rot: 0 }): {
  x: number
  y: number
  rot: number
} {
  out.x = 16 * Math.sin(u * TAU * 2)
  out.y = -30 + 90 * u
  out.rot = 0.6 * Math.sin(u * TAU * 3)
  return out
}

/** Alpha for the ghost book pulse (0.4 to 0.65); fixed 0.55 when reduced. */
export function ghostAlpha(timeMs: number, phase: number, reduced: boolean): number {
  return reduced ? 0.55 : 0.525 + 0.125 * Math.sin((TAU * timeMs) / 3000 + phase * TAU)
}

export const LIGHTNING_MAX_ALPHA = 0.25
export const LIGHTNING_MIN_GAP_MS = 8000
const LIGHTNING_TOTAL_MS = 360

/**
 * Soft lightning overlay alpha `sinceMs` after the strike starts: two short pulses (0 to 90 ms and
 * 200 to 300 ms), never above LIGHTNING_MAX_ALPHA. Zero before the start and after the strike.
 */
export function lightningAlpha(sinceMs: number): number {
  if (sinceMs < 0 || sinceMs >= LIGHTNING_TOTAL_MS) return 0
  if (sinceMs < 90) return LIGHTNING_MAX_ALPHA * Math.sin((Math.PI * sinceMs) / 90)
  if (sinceMs >= 200 && sinceMs < 300) return 0.7 * LIGHTNING_MAX_ALPHA * Math.sin((Math.PI * (sinceMs - 200)) / 100)
  return 0
}
