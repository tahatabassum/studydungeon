import { propBlockers } from './keepOut'
import { placeProps, type PlacedProp, type PropKind } from './propPlacement'
import { TORCHES, type Rect } from './RoomLayout'
import type { LightSpec } from './roomTheme'

/** Stone coffins with lids ajar (room-local rects). Visual only: no colliders. */
export const CRYPT_COFFINS: readonly Rect[] = [
  { x: 40, y: 240, w: 56, h: 104 },
  { x: 40, y: 480, w: 56, h: 104 },
  { x: 1184, y: 460, w: 56, h: 104 },
]

/** The north wall elevation art zone (clock, pipes, gears), y 0 to 128. */
export const CRYPT_NORTH_BAND: Rect = { x: 32, y: 32, w: 1216, h: 96 }

export const CRYPT_PROP_KINDS: readonly PropKind[] = [
  { kind: 'bone', size: { w: 12, h: 6 }, count: 6 },
  { kind: 'candle', size: { w: 8, h: 12 }, count: 5 },
  { kind: 'paper', size: { w: 14, h: 10 }, count: 5 },
  { kind: 'rune', size: { w: 48, h: 48 }, count: 3 },
]

/** Everything scatter props must stay out of in the Clockwork Crypt. */
export function cryptBlockers(): Rect[] {
  const torchRects = TORCHES.map((t) => ({ x: t.x - 24, y: t.y - 24, w: 48, h: 48 }))
  return [...propBlockers(), ...CRYPT_COFFINS, CRYPT_NORTH_BAND, ...torchRects]
}

/** Warm flickering pools at each placed candle (room-local centers, radius 48). */
export function cryptCandleLights(seed: number): LightSpec[] {
  return cryptProps(seed)
    .filter((p) => p.kind === 'candle')
    .map((p, i) => ({
      x: p.x + p.w / 2,
      y: p.y + 2,
      radius: 48,
      glow: 'warm' as const,
      min: 0.5,
      max: 1.0,
      seed: 100 + i,
    }))
}

/** Deterministic scatter props for the crypt (room-local top-left coordinates). */
export function cryptProps(seed: number): PlacedProp[] {
  return placeProps(seed, CRYPT_PROP_KINDS, cryptBlockers())
}
