/** Portrait character ids, poses and the monster-kind mapping. Pure data: no canvas, no React. */

export const PORTRAIT_KINDS = ['ghost', 'vampire', 'skeleton', 'golem', 'witch', 'warden', 'revenant'] as const
export type PortraitKind = (typeof PORTRAIT_KINDS)[number]

export const POSES = ['idle', 'talking', 'hurt', 'taunt', 'defeated'] as const
export type Pose = (typeof POSES)[number]

/** Logical drawing size of a portrait (the canvas is scaled with CSS). */
export const PORTRAIT_W = 360
export const PORTRAIT_H = 480

/** Draws one pose of one character onto a PORTRAIT_W x PORTRAIT_H canvas. */
export type PortraitDrawer = (ctx: CanvasRenderingContext2D, pose: Pose) => void

/** Backend monster kind -> character. Anything not listed (or not a string) falls back to the Skeleton. */
const KIND_TO_PORTRAIT: Readonly<Record<string, PortraitKind>> = {
  paper_wraith: 'ghost',
  ghost: 'ghost',
  toxic_slime: 'witch',
  witch: 'witch',
  gear_golem: 'golem',
  clockwork_golem: 'golem',
  memory_eater: 'vampire',
  vampire: 'vampire',
  exam_warden: 'warden',
  skeleton: 'skeleton',
  revenant: 'revenant',
}

export function portraitFor(kind: string): PortraitKind {
  return Object.prototype.hasOwnProperty.call(KIND_TO_PORTRAIT, kind) ? KIND_TO_PORTRAIT[kind] : 'skeleton'
}
