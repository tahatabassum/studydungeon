/**
 * Pure hit-feel plan (D22). No Phaser import. Phaser applies the numbers; nothing here decides outcomes:
 * `critical` and `bossKill` are read from the Answer_Result by the caller.
 */

/** Hit-stop on a strong hit, in ms. Longer would read as lag. */
export const HIT_STOP_MS = 60
/** Camera shake on a strong hit, in ms, and its intensity. */
export const HIT_SHAKE_MS = 140
export const HIT_SHAKE_INTENSITY = 0.004
/** Highest alpha any full-screen flash may reach (photosensitivity guard). */
export const FLASH_ALPHA_MAX = 0.35

export interface HitPlan {
  hitStopMs: number
  shakeMs: number
  shakeIntensity: number
  /** A single quick white flash (alpha at most FLASH_ALPHA_MAX). */
  flash: boolean
  /** Scale of the damage-number pop at its peak (1 means no pop). */
  popScale: number
  /** Distance of the monster knockback in px (0 means none). */
  knockbackPx: number
}

export interface HitInput {
  critical: boolean
  bossKill: boolean
  reducedMotion: boolean
}

const NONE: HitPlan = Object.freeze({
  hitStopMs: 0,
  shakeMs: 0,
  shakeIntensity: 0,
  flash: false,
  popScale: 1,
  knockbackPx: 0,
})

const NORMAL: HitPlan = Object.freeze({ ...NONE, popScale: 1.15, knockbackPx: 8 })
const CRITICAL: HitPlan = Object.freeze({
  hitStopMs: HIT_STOP_MS,
  shakeMs: HIT_SHAKE_MS,
  shakeIntensity: HIT_SHAKE_INTENSITY,
  flash: true,
  popScale: 1.45,
  knockbackPx: 16,
})
const BOSS_KILL: HitPlan = Object.freeze({ ...CRITICAL, popScale: 1.6, knockbackPx: 12 })

/**
 * Reduced motion: no hit-stop, no shake, no flash, no pop, no knockback.
 * Otherwise hit-stop and shake apply only to critical hits and boss-killing blows.
 * Returns shared frozen objects, so planning a hit allocates nothing.
 */
export function planHit(input: HitInput): HitPlan {
  if (input.reducedMotion) return NONE
  if (input.bossKill) return BOSS_KILL
  if (input.critical) return CRITICAL
  return NORMAL
}
