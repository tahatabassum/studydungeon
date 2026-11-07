import { COLORS } from '../colors'

/** Pure monster visual styles (no Phaser import) so they are unit-testable. */
export interface MonsterStyle {
  /** Procedural texture key generated in BootScene. */
  texture: string
  /** Sprite tint color. */
  tint: number
  /** Aura glow color. */
  aura: number
  scale: number
}

const KNOWN: Record<string, MonsterStyle> = {
  paper_wraith: { texture: 'monster', tint: 0xffffff, aura: COLORS.MAGIC, scale: 1 },
  toxic_slime: { texture: 'monster-slime', tint: 0xffffff, aura: 0x4fbf5a, scale: 1 },
  gear_golem: { texture: 'monster-gear', tint: 0xffffff, aura: COLORS.ACCENT, scale: 1 },
  memory_eater: { texture: 'monster-eater', tint: 0xffffff, aura: 0x3fa7c9, scale: 1 },
  exam_warden: { texture: 'monster-eater', tint: 0xd04a5a, aura: COLORS.DANGER, scale: 1.8 },
}

const DEFAULT_STYLE: MonsterStyle = {
  texture: 'monster',
  tint: 0xc9c2d6,
  aura: COLORS.MAGIC,
  scale: 1,
}

export const BOSS_SCALE = 1.8

/** Boss uses the exam_warden look and always the boss scale; unknown kinds get the default. */
export function getMonsterStyle(kind: string | undefined, isBoss: boolean): MonsterStyle {
  if (isBoss) return { ...KNOWN.exam_warden, scale: BOSS_SCALE }
  const known = kind !== undefined && Object.hasOwn(KNOWN, kind) ? KNOWN[kind] : undefined
  const style = known ?? DEFAULT_STYLE
  // A non-boss never uses the boss look or scale.
  if (style === KNOWN.exam_warden) return { ...DEFAULT_STYLE }
  return { ...style }
}
