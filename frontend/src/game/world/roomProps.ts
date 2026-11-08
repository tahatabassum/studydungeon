import { CRYPT_COFFINS, CRYPT_NORTH_BAND, CRYPT_PROP_KINDS, cryptBlockers, cryptProps } from './cryptProps'
import { propBlockers } from './keepOut'
import { placeProps, type PlacedProp, type PropKind } from './propPlacement'
import { TORCHES, type Rect } from './RoomLayout'
import type { LightSpec, ThemeId } from './roomTheme'

/**
 * Per-room static dressing data (room-local coordinates). `band` is the north wall elevation art
 * zone (may span the gate); `fixed` are furniture rects that must stay out of the Keep_Out_Zone
 * and pillars; `kinds` are the scatter props. Visual only: no colliders are added.
 */
export interface RoomDressing {
  band: Rect
  fixed: readonly Rect[]
  kinds: readonly PropKind[]
}

const BAND: Rect = CRYPT_NORTH_BAND

export const LIBRARY_FIXED: readonly Rect[] = [
  { x: 32, y: 200, w: 48, h: 150 }, // west shelves
  { x: 32, y: 450, w: 48, h: 150 },
  { x: 1200, y: 200, w: 48, h: 150 }, // east shelves
  { x: 1200, y: 450, w: 48, h: 150 },
  { x: 300, y: 560, w: 120, h: 60 }, // reading tables
  { x: 860, y: 560, w: 120, h: 60 },
]

export const WITCH_FIXED: readonly Rect[] = [
  { x: 900, y: 270, w: 100, h: 100 }, // cauldron
  { x: 300, y: 260, w: 130, h: 60 }, // workbench
  { x: 32, y: 450, w: 56, h: 140 }, // potion racks
  { x: 1192, y: 470, w: 56, h: 140 },
]

/** Jack-o'-lanterns (3), hay bales, scarecrow, workbench. */
export const PUMPKIN_FIXED: readonly Rect[] = [
  { x: 372, y: 290, w: 60, h: 56 },
  { x: 868, y: 290, w: 60, h: 56 },
  { x: 880, y: 560, w: 64, h: 60 },
  { x: 40, y: 176, w: 96, h: 64 }, // hay
  { x: 1136, y: 620, w: 96, h: 64 },
  { x: 1150, y: 230, w: 64, h: 110 }, // scarecrow
  { x: 300, y: 600, w: 140, h: 60 }, // workbench
]

export const BOSS_FIXED: readonly Rect[] = [
  { x: 1160, y: 236, w: 88, h: 120 }, // bone throne
  { x: 40, y: 236, w: 64, h: 100 }, // tome lectern
  { x: 274, y: 244, w: 112, h: 112 }, // chandeliers
  { x: 894, y: 244, w: 112, h: 112 },
]

export const ROOM_DRESSING: Readonly<Partial<Record<ThemeId, RoomDressing>>> = {
  clockwork_crypt: { band: BAND, fixed: CRYPT_COFFINS, kinds: CRYPT_PROP_KINDS },
  library: {
    band: BAND,
    fixed: LIBRARY_FIXED,
    kinds: [
      { kind: 'paper', size: { w: 14, h: 10 }, count: 6 },
      { kind: 'candle', size: { w: 8, h: 12 }, count: 3 },
      { kind: 'fallen_book', size: { w: 16, h: 10 }, count: 4 },
    ],
  },
  witch_lab: {
    band: BAND,
    fixed: WITCH_FIXED,
    kinds: [
      { kind: 'vial', size: { w: 8, h: 12 }, count: 5 },
      { kind: 'bone', size: { w: 12, h: 6 }, count: 4 },
      { kind: 'paper', size: { w: 14, h: 10 }, count: 3 },
      { kind: 'rune', size: { w: 48, h: 48 }, count: 2 },
    ],
  },
  pumpkin_workshop: {
    band: BAND,
    fixed: PUMPKIN_FIXED,
    kinds: [
      { kind: 'mini_pumpkin', size: { w: 20, h: 18 }, count: 4 },
      { kind: 'straw', size: { w: 16, h: 6 }, count: 6 },
      { kind: 'candle', size: { w: 8, h: 12 }, count: 2 },
    ],
  },
  boss_hall: {
    band: BAND,
    fixed: BOSS_FIXED,
    kinds: [
      { kind: 'bone', size: { w: 12, h: 6 }, count: 5 },
      { kind: 'paper', size: { w: 14, h: 10 }, count: 4 },
      { kind: 'rune', size: { w: 48, h: 48 }, count: 2 },
    ],
  },
}

/** Everything scatter props must stay out of in the given room. */
export function roomBlockers(id: ThemeId): Rect[] {
  if (id === 'clockwork_crypt') return cryptBlockers()
  const d = ROOM_DRESSING[id]
  if (!d) return propBlockers()
  const torchRects = TORCHES.map((t) => ({ x: t.x - 24, y: t.y - 24, w: 48, h: 48 }))
  return [...propBlockers(), ...d.fixed, d.band, ...torchRects]
}

/** Deterministic scatter props for a room (room-local top-left coordinates); empty for the entry. */
export function roomProps(id: ThemeId, seed: number): PlacedProp[] {
  if (id === 'clockwork_crypt') return cryptProps(seed)
  const d = ROOM_DRESSING[id]
  return d ? placeProps(seed, d.kinds, roomBlockers(id)) : []
}

/** Warm flickering pools at each placed candle (room-local centers, radius 48). */
export function roomCandleLights(id: ThemeId, seed: number): LightSpec[] {
  return roomProps(id, seed)
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
