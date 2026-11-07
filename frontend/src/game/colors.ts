/** Numeric palette (0xRRGGBB) mirroring the --color-* tokens in src/index.css. Pure TS: no app imports. */
export const COLORS = {
  BG: 0x100b18,
  SURFACE_2: 0x1c1427,
  PANEL: 0x251a32,
  DEEP: 0x39244f,
  MAGIC: 0x9b5de5,
  ACCENT: 0xff9f1c,
  INK: 0xf5ebdd,
  INK_MUTED: 0xb9aec9,
  DANGER: 0xc83e4d,
  HEALTH: 0x59c9a5,
  GOLD: 0xe9b44c,
} as const

export type ColorName = keyof typeof COLORS

/** Convert a numeric color to a '#RRGGBB' string (for Phaser text styles). */
export function toCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0').toUpperCase()}`
}

/** CSS string versions of the palette for Phaser text. */
export const CSS_COLORS: Record<ColorName, string> = {
  BG: toCss(COLORS.BG),
  SURFACE_2: toCss(COLORS.SURFACE_2),
  PANEL: toCss(COLORS.PANEL),
  DEEP: toCss(COLORS.DEEP),
  MAGIC: toCss(COLORS.MAGIC),
  ACCENT: toCss(COLORS.ACCENT),
  INK: toCss(COLORS.INK),
  INK_MUTED: toCss(COLORS.INK_MUTED),
  DANGER: toCss(COLORS.DANGER),
  HEALTH: toCss(COLORS.HEALTH),
  GOLD: toCss(COLORS.GOLD),
}
