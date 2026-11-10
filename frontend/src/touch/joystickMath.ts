/** Pure virtual-joystick math. No DOM, no Phaser. */

export interface Vec2 {
  x: number
  y: number
}

/** Fraction of the stick radius inside which the stick reads as centred. */
export const DEAD_ZONE = 0.18

/** Values are rounded to this step so tiny finger jitter does not flood the bridge. */
const STEP = 0.05

/**
 * Analog vector from a thumb offset (dx, dy in px from the stick centre) and the stick radius.
 * Inside the dead zone the result is (0, 0). Outside it the length grows from 0 at the dead-zone edge
 * to 1 at the rim and stays 1 beyond it (clamped), keeping the direction. Always finite, length <= 1.
 */
export function joystickVector(dx: number, dy: number, radius: number, deadZone: number = DEAD_ZONE): Vec2 {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return { x: 0, y: 0 }
  const dist = Math.hypot(dx, dy)
  const dz = Math.min(Math.max(deadZone, 0), 0.95) * radius
  if (dist <= dz || dist === 0) return { x: 0, y: 0 }
  const mag = Math.min(1, (dist - dz) / (radius - dz))
  const ux = dx / dist
  const uy = dy / dist
  const q = (v: number): number => {
    const r = Math.round(v / STEP) * STEP
    return Math.abs(r) < 1e-9 ? 0 : Number(r.toFixed(2))
  }
  const out = { x: q(ux * mag), y: q(uy * mag) }
  // Rounding must never push the length above 1.
  const len = Math.hypot(out.x, out.y)
  if (len > 1) {
    // Truncate (not round) so the result can only shrink: its length stays at most 1.
    out.x = Math.trunc((out.x / len) * 100) / 100 || 0
    out.y = Math.trunc((out.y / len) * 100) / 100 || 0
  }
  return out
}

/** True when two vectors are the same value (so an unchanged stick sends nothing). */
export function sameVector(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y
}

/** Thumb knob offset in px: the pointer offset clamped to the radius. */
export function clampToRadius(dx: number, dy: number, radius: number): Vec2 {
  const dist = Math.hypot(dx, dy)
  if (!(dist > radius) || dist === 0) return { x: dx, y: dy }
  const k = radius / dist
  return { x: dx * k, y: dy * k }
}
