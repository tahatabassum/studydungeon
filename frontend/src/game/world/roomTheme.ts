/** Pure room theme data. No Phaser import; sprite names refer to SPRITE_REGISTRY. */
export type ThemeId =
  | 'entry'
  | 'library'
  | 'witch_lab'
  | 'clockwork_crypt'
  | 'pumpkin_workshop'
  | 'boss_hall'

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

/** Colors used by the procedural floor and wall generators. */
export interface ThemePalette {
  floorBase: number
  floorTones: readonly number[]
  wallTop: number
  wallInner: number
  mortar: number
  accentLight: number
  coolShadow: number
}

export type GlowKey = 'warm' | 'cool' | 'green' | 'purple' | 'red'

/** A flickering additive light pool in room-local coordinates. */
export interface LightSpec {
  x: number
  y: number
  radius: number
  glow: GlowKey
  min: number
  max: number
  seed: number
}

export type PieceKind =
  | 'clockHands'
  | 'pendulum'
  | 'gear'
  | 'steam'
  | 'bat'
  | 'flame'
  | 'candle'
  | 'bubble'
  | 'page'
  | 'book'
  | 'jar'
  | 'lightning'

/** An animated piece group (count = number of pooled objects it uses). */
export interface PieceSpec {
  kind: PieceKind
  x: number
  y: number
  count: number
  /** Glow color for 'flame' pieces (default warm). */
  glow?: GlowKey
}

export interface RoomTheme {
  id: ThemeId
  /** Two floor tile colors for the fallback checker pattern. */
  floor: readonly [number, number]
  palette: ThemePalette
  decor: readonly DecorSpec[]
  /** Fixed theme lights (torches are added by the scene for every room). */
  lights: readonly LightSpec[]
  pieces: readonly PieceSpec[]
  particles: ParticleSpec
  /** Translucent room tint. */
  light: { tint: number; alpha: number }
  /** Optional per-torch glow colors (index matches TORCHES); default warm. */
  torchGlows?: readonly GlowKey[]
  /** Fog strength multiplier (default 1). */
  fog?: number
}

const entryDecor: DecorSpec[] = [
  { sprite: 'decor_candle', slot: { at: 'south', offset: 160 } },
  { sprite: 'decor_candle', slot: { at: 'south', offset: 1120 } },
]

const stone = (
  floorBase: number,
  floorTones: readonly number[],
  wallTop: number,
  wallInner: number,
  accentLight: number,
): ThemePalette => ({
  floorBase,
  floorTones,
  wallTop,
  wallInner,
  mortar: 0x0c0912,
  accentLight,
  coolShadow: 0x1a1638,
})

export const THEMES: Readonly<Record<ThemeId, RoomTheme>> = {
  entry: {
    id: 'entry',
    floor: [0x1a1424, 0x211a2e],
    palette: stone(0x1c1626, [0x1a1424, 0x211a2e, 0x261e34], 0x3a3050, 0x201a30, 0xb9aec9),
    decor: [
      ...entryDecor,
      { sprite: 'decor_column', slot: { at: 'west', offset: 200 } },
      { sprite: 'decor_column', slot: { at: 'east', offset: 200 } },
    ],
    lights: [],
    pieces: [],
    particles: { kind: 'dust', count: 10, color: 0xb9aec9 },
    light: { tint: 0x9b5de5, alpha: 0.03 },
  },
  library: {
    id: 'library',
    floor: [0x26192a, 0x30202f],
    palette: stone(0x281c2c, [0x26192a, 0x30202f, 0x38262f], 0x4a3446, 0x2a1c2c, 0xe9a23b),
    // Shelves, window, cobwebs and tables are baked (art/room/library.ts); two floor candles stay sprites.
    decor: entryDecor,
    // Focal glow: cool moonlight from the arched window against warm candle pools.
    lights: [{ x: 940, y: 180, radius: 150, glow: 'cool', min: 0.75, max: 1.0, seed: 21 }],
    pieces: [
      { kind: 'candle', x: 400, y: 300, count: 1 },
      { kind: 'candle', x: 880, y: 300, count: 1 },
      { kind: 'candle', x: 360, y: 520, count: 1 },
      { kind: 'candle', x: 920, y: 520, count: 1 },
      { kind: 'page', x: 450, y: 200, count: 1 },
      { kind: 'page', x: 800, y: 420, count: 1 },
      { kind: 'page', x: 300, y: 480, count: 1 },
      { kind: 'page', x: 1000, y: 260, count: 1 },
      { kind: 'book', x: 300, y: 250, count: 1 },
      { kind: 'book', x: 1000, y: 400, count: 1 },
      { kind: 'book', x: 450, y: 640, count: 1 },
    ],
    particles: { kind: 'dust', count: 12, color: 0xe9b44c },
    light: { tint: 0xff9f1c, alpha: 0.05 },
  },
  witch_lab: {
    id: 'witch_lab',
    floor: [0x13241f, 0x1a2f28],
    palette: stone(0x15271f, [0x13241f, 0x1a2f28, 0x20362d], 0x2f4a3f, 0x13241f, 0x8be04e),
    // Cauldron, shelves, herbs and jars are baked (art/room/witchLab.ts); two floor candles stay sprites.
    decor: entryDecor,
    // Focal glow: the green cauldron, answered by a purple pool at the workbench.
    lights: [
      { x: 950, y: 310, radius: 140, glow: 'green', min: 0.7, max: 1.0, seed: 31 },
      { x: 360, y: 300, radius: 110, glow: 'purple', min: 0.6, max: 1.0, seed: 32 },
    ],
    pieces: [
      { kind: 'bubble', x: 950, y: 288, count: 6 },
      { kind: 'jar', x: 110, y: 82, count: 1 },
      { kind: 'jar', x: 430, y: 82, count: 1 },
    ],
    particles: { kind: 'bubble', count: 14, color: 0x8fe3c6 },
    light: { tint: 0x59c9a5, alpha: 0.06 },
  },
  clockwork_crypt: {
    id: 'clockwork_crypt',
    floor: [0x2a2118, 0x352a1d],
    palette: {
      floorBase: 0x2a2320,
      floorTones: [0x241e1f, 0x2b2422, 0x322a26, 0x282226, 0x2f2823],
      wallTop: 0x4a3f4a,
      wallInner: 0x1f1a24,
      mortar: 0x0f0b14,
      accentLight: 0xe9a23b,
      coolShadow: 0x1a1638,
    },
    // Hanging chains (design: x 480 and 800 on the north wall).
    decor: [
      { sprite: 'decor_chain', slot: { at: 'north', offset: 480 } },
      { sprite: 'decor_chain', slot: { at: 'north', offset: 800 } },
    ],
    // Warm amber back-glow behind the broken clock face; candle pools come from placed props.
    lights: [{ x: 352, y: 64, radius: 96, glow: 'warm', min: 0.7, max: 1.0, seed: 11 }],
    pieces: [
      { kind: 'clockHands', x: 352, y: 64, count: 2 },
      { kind: 'pendulum', x: 952, y: 38, count: 1 },
      { kind: 'gear', x: 1120, y: 72, count: 2 },
      { kind: 'steam', x: 800, y: 44, count: 6 },
      { kind: 'bat', x: 496, y: 24, count: 3 },
    ],
    particles: { kind: 'spark', count: 10, color: 0xff9f1c },
    light: { tint: 0xff9f1c, alpha: 0.04 },
  },
  pumpkin_workshop: {
    id: 'pumpkin_workshop',
    floor: [0x14171f, 0x1c2030],
    palette: stone(0x2a1f18, [0x261c16, 0x2d2119, 0x34261c], 0x5a4030, 0x241a14, 0xf28a1e),
    // Jack-o'-lanterns, hay, scarecrow and tools are baked (art/room/pumpkinWorkshop.ts); two floor candles stay sprites.
    decor: entryDecor,
    // Focal glow: three jack-o'-lanterns in warm orange.
    lights: [
      { x: 402, y: 318, radius: 96, glow: 'warm', min: 0.55, max: 1.0, seed: 41 },
      { x: 898, y: 318, radius: 96, glow: 'warm', min: 0.55, max: 1.0, seed: 42 },
      { x: 912, y: 590, radius: 96, glow: 'warm', min: 0.55, max: 1.0, seed: 43 },
    ],
    pieces: [
      { kind: 'flame', x: 402, y: 320, count: 1 },
      { kind: 'flame', x: 898, y: 320, count: 1 },
      { kind: 'flame', x: 912, y: 592, count: 1 },
    ],
    particles: { kind: 'ember', count: 16, color: 0xf28a1e },
    light: { tint: 0xf28a1e, alpha: 0.06 },
  },
  boss_hall: {
    id: 'boss_hall',
    floor: [0x2a1019, 0x381622],
    palette: stone(0x2a1420, [0x2a1019, 0x381622, 0x321a2a], 0x5a2a3c, 0x230e18, 0xc04bd6),
    decor: [{ sprite: 'decor_rune', slot: { at: 'floor', x: 640, y: 470 } }],
    // Focal glow: the giant moon window, with purple fire from two chandeliers.
    lights: [
      { x: 880, y: 190, radius: 170, glow: 'cool', min: 0.75, max: 1.0, seed: 51 },
      { x: 330, y: 300, radius: 120, glow: 'purple', min: 0.6, max: 1.0, seed: 52 },
      { x: 950, y: 300, radius: 120, glow: 'purple', min: 0.6, max: 1.0, seed: 53 },
    ],
    pieces: [
      { kind: 'flame', x: 304, y: 296, count: 1, glow: 'purple' },
      { kind: 'flame', x: 330, y: 286, count: 1, glow: 'purple' },
      { kind: 'flame', x: 356, y: 296, count: 1, glow: 'purple' },
      { kind: 'flame', x: 924, y: 296, count: 1, glow: 'purple' },
      { kind: 'flame', x: 950, y: 286, count: 1, glow: 'purple' },
      { kind: 'flame', x: 976, y: 296, count: 1, glow: 'purple' },
      { kind: 'lightning', x: 0, y: 0, count: 1 },
    ],
    particles: { kind: 'ember', count: 16, color: 0xc83e4d },
    light: { tint: 0xc83e4d, alpha: 0.07 },
    torchGlows: ['red', 'purple', 'purple', 'red'],
    fog: 2,
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

const KIND_THEME: Readonly<Record<string, ThemeId>> = {
  paper_wraith: 'library',
  toxic_slime: 'witch_lab',
  gear_golem: 'clockwork_crypt',
  memory_eater: 'pumpkin_workshop',
}

/**
 * Data-driven theme selection: boss rooms use the boss hall theme; otherwise the
 * monster kind decides; unknown or missing kinds get the entry theme.
 */
export function selectTheme(kind: string | undefined, isBoss: boolean): RoomTheme {
  if (isBoss) return THEMES.boss_hall
  const id = kind !== undefined && Object.hasOwn(KIND_THEME, kind) ? KIND_THEME[kind] : 'entry'
  return THEMES[id]
}
