export interface MoveInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

/**
 * Pure: keyboard wins when any key direction is active; otherwise the analog touch vector is used,
 * clamped to length 1 so touch speed never exceeds keyboard speed. Writes into `out` (no allocation).
 */
export function combineMovement(
  keyX: number,
  keyY: number,
  touchX: number,
  touchY: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  if (keyX !== 0 || keyY !== 0) {
    out.x = keyX
    out.y = keyY
    return out
  }
  const x = Number.isFinite(touchX) ? touchX : 0
  const y = Number.isFinite(touchY) ? touchY : 0
  const len = Math.hypot(x, y)
  const k = len > 1 ? 1 / len : 1
  out.x = x * k
  out.y = y * k
  return out
}

/** Pure: unit-length (or zero) direction. Opposite keys cancel; diagonals are normalized. */
export function movementVector(input: MoveInput): { x: number; y: number } {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (x === 0 && y === 0) return { x: 0, y: 0 }
  const len = Math.hypot(x, y)
  return { x: x / len, y: y / len }
}
