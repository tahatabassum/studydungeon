/** Pure room theme data. No Phaser import; sprite names refer to SPRITE_REGISTRY. */
export type ThemeId = 'entry' | 'library' | 'lab' | 'workshop' | 'crypt' | 'throne'

/** Global cap on atmosphere particles shown at once (all themes). */
export const MAX_PARTICLES = 24

/** Where a decor sprite goes, relative to the room rect (px along the wall). */
export type DecorSlot =
  | { at: 'north' | 'south' | 'west' | 'east'; offset: number }
  | { at: 'corner-nw' | 'corner-ne' }
  | { at: 'floor'; x: number; y: number }

export interface DecorSpec {
  sprite: string
  slot: DecorSlot
}

export interface ParticleSpec {
  kind: 'dust' | 'bubble' | 'ember' | 'spark' | 'mist'
  count: number
  color: number
}

export interface RoomTheme {
  id: ThemeId
  /** Two floor tile colors for the checker pattern. */
  floor: readonly [number, number]
  decor: readonly DecorSpec[]
  particles: ParticleSpec
  /** Translucent room tint. */
  light: { tint: number; alpha: number }
}

const entryDecor: DecorSpec[] = [
  { sprite: 'decor_candle', slot: { at: 'south', offset: 160 } },
  { sprite: 'decor_candle', slot: { at: 'south', offset: 1120 } },
]

export const THEMES: Readonly<Record<ThemeId, RoomTheme>> = {
  entry: {
    id: 'entry',
    floor: [0x1a1424, 0x211a2e],
    decor: [
      ...entryDecor,
      { sprite: 'decor_column', slot: { at: 'west', offset: 200 } },
      { sprite: 'decor_column', slot: { at: 'east', offset: 200 } },
    ],
    particles: { kind: 'dust', count: 10, color: 0xb9aec9 },
    light: { tint: 0x9b5de5, alpha: 0.03 },
  },
  library: {
    id: 'library',
    floor: [0x26192a, 0x30202f],
    decor: [
      { sprite: 'decor_bookshelf', slot: { at: 'north', offset: 112 } },
      { sprite: 'decor_bookshelf', slot: { at: 'north', offset: 400 } },
      { sprite: 'decor_bookshelf', slot: { at: 'north', offset: 880 } },
      { sprite: 'decor_bookshelf', slot: { at: 'north', offset: 1168 } },
      { sprite: 'decor_cobweb', slot: { at: 'corner-nw' } },
      ...entryDecor,
    ],
    particles: { kind: 'dust', count: 12, color: 0xe9b44c },
    light: { tint: 0xff9f1c, alpha: 0.05 },
  },
  lab: {
    id: 'lab',
    floor: [0x13241f, 0x1a2f28],
    decor: [
      { sprite: 'decor_cauldron', slot: { at: 'north', offset: 400 } },
      { sprite: 'decor_cauldron', slot: { at: 'north', offset: 880 } },
      { sprite: 'decor_potion', slot: { at: 'west', offset: 200 } },
      { sprite: 'decor_potion', slot: { at: 'east', offset: 600 } },
      { sprite: 'decor_cobweb', slot: { at: 'corner-nw' } },
    ],
    particles: { kind: 'bubble', count: 14, color: 0x8fe3c6 },
    light: { tint: 0x59c9a5, alpha: 0.06 },
  },
  workshop: {
    id: 'workshop',
    floor: [0x2a2118, 0x352a1d],
    decor: [
      { sprite: 'decor_gear', slot: { at: 'north', offset: 112 } },
      { sprite: 'decor_gear', slot: { at: 'north', offset: 1168 } },
      { sprite: 'decor_chain', slot: { at: 'north', offset: 400 } },
      { sprite: 'decor_chain', slot: { at: 'north', offset: 880 } },
      { sprite: 'decor_gear', slot: { at: 'west', offset: 600 } },
    ],
    particles: { kind: 'spark', count: 10, color: 0xff9f1c },
    light: { tint: 0xff9f1c, alpha: 0.07 },
  },
  crypt: {
    id: 'crypt',
    floor: [0x14171f, 0x1c2030],
    decor: [
      { sprite: 'decor_tomb', slot: { at: 'west', offset: 200 } },
      { sprite: 'decor_tomb', slot: { at: 'west', offset: 600 } },
      { sprite: 'decor_tomb', slot: { at: 'east', offset: 600 } },
      { sprite: 'decor_cobweb', slot: { at: 'corner-nw' } },
      { sprite: 'decor_candle', slot: { at: 'north', offset: 400 } },
    ],
    particles: { kind: 'mist', count: 12, color: 0x7a7388 },
    light: { tint: 0x3fa7c9, alpha: 0.06 },
  },
  throne: {
    id: 'throne',
    floor: [0x2a1019, 0x381622],
    decor: [
      { sprite: 'decor_column', slot: { at: 'north', offset: 112 } },
      { sprite: 'decor_column', slot: { at: 'north', offset: 1168 } },
      { sprite: 'decor_column', slot: { at: 'west', offset: 200 } },
      { sprite: 'decor_column', slot: { at: 'east', offset: 200 } },
      { sprite: 'decor_rune', slot: { at: 'floor', x: 640, y: 470 } },
    ],
    particles: { kind: 'ember', count: 16, color: 0xc83e4d },
    light: { tint: 0xc83e4d, alpha: 0.07 },
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

const KIND_THEME: Readonly<Record<string, ThemeId>> = {
  paper_wraith: 'library',
  toxic_slime: 'lab',
  gear_golem: 'workshop',
  memory_eater: 'crypt',
}

/**
 * Data-driven theme selection: boss rooms use the throne theme; otherwise the
 * monster kind decides; unknown or missing kinds get the entry theme.
 */
export function selectTheme(kind: string | undefined, isBoss: boolean): RoomTheme {
  if (isBoss) return THEMES.throne
  const id = kind !== undefined && Object.hasOwn(KIND_THEME, kind) ? KIND_THEME[kind] : 'entry'
  return THEMES[id]
}
