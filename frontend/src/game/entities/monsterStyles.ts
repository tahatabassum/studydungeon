import { animKey, frameName } from '@/art/frames'
import { COLORS } from '../colors'

/** Pure monster visual styles (no Phaser import) so they are unit-testable. */
export interface MonsterStyle {
  /** Base sprite name (MONSTER_SPRITES key). */
  sprite: string
  /** First idle frame texture key (registered by registerArt). */
  texture: string
  /** Animation keys (registered by registerArt). */
  anims: { idle: string; attack: string; hit: string; death: string }
  /** Sprite tint color (0xffffff = none). */
  tint: number
  /** Aura glow color. */
  aura: number
  /** Integer-friendly display scale of the pixel art. */
  scale: number
}

/** Display scale for regular monsters. */
export const MONSTER_SCALE = 2
/** Display scale for the boss (about 3x of a 32px sprite so it reads as large). */
export const BOSS_SCALE = 3

function style(sprite: string, tint: number, aura: number, scale: number): MonsterStyle {
  return {
    sprite,
    texture: frameName(sprite, 'idle', 0),
    anims: {
      idle: animKey(sprite, 'idle'),
      attack: animKey(sprite, 'attack'),
      hit: animKey(sprite, 'hit'),
      death: animKey(sprite, 'death'),
    },
    tint,
    aura,
    scale,
  }
}

const KNOWN: Record<string, MonsterStyle> = {
  paper_wraith: style('paper_wraith', 0xffffff, COLORS.MAGIC, MONSTER_SCALE),
  toxic_slime: style('toxic_slime', 0xffffff, 0x4fbf5a, MONSTER_SCALE),
  gear_golem: style('gear_golem', 0xffffff, COLORS.ACCENT, MONSTER_SCALE),
  memory_eater: style('memory_eater', 0xffffff, 0x3fa7c9, MONSTER_SCALE),
  exam_warden: style('exam_warden', 0xffffff, COLORS.DANGER, BOSS_SCALE),
}

const DEFAULT_STYLE: MonsterStyle = style('paper_wraith', 0xc9c2d6, COLORS.MAGIC, MONSTER_SCALE)

/** Boss uses the exam_warden look and always the boss scale; unknown kinds get the default. */
export function getMonsterStyle(kind: string | undefined, isBoss: boolean): MonsterStyle {
  if (isBoss) return { ...KNOWN.exam_warden, scale: BOSS_SCALE }
  const known = kind !== undefined && Object.hasOwn(KNOWN, kind) ? KNOWN[kind] : undefined
  const chosen = known ?? DEFAULT_STYLE
  // A non-boss never uses the boss look or scale.
  if (chosen === KNOWN.exam_warden) return { ...DEFAULT_STYLE }
  return { ...chosen }
}
