export interface MoveInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

/** Pure: unit-length (or zero) direction. Opposite keys cancel; diagonals are normalized. */
export function movementVector(input: MoveInput): { x: number; y: number } {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  if (x === 0 && y === 0) return { x: 0, y: 0 }
  const len = Math.hypot(x, y)
  return { x: x / len, y: y / len }
}
