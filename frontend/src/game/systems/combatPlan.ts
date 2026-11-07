import type { AnswerResult } from '@/types/api'

export type CombatStep =
  | 'projectile'
  | 'hit-flash'
  | 'damage-number'
  | 'monster-hp'
  | 'monster-attack'
  | 'camera-shake'
  | 'player-flash'
  | 'monster-defeat'
  | 'gate-open'

export interface CombatPlan {
  steps: CombatStep[]
  /** Camera shake duration in ms. Always <= 150 and 0 for reduced motion. */
  shakeMs: number
  /** Text for the floating number over the monster, or null. */
  damageText: string | null
}

export const SHAKE_MS = 120

/**
 * Pure: derives the animation steps from an AnswerResult only.
 * Never computes damage or HP; it only echoes result fields.
 */
export function planCombat(result: AnswerResult, reducedMotion: boolean): CombatPlan {
  const steps: CombatStep[] = []
  let shakeMs = 0
  let damageText: string | null = null

  if (result.correct) {
    steps.push('projectile')
    if (!reducedMotion) steps.push('hit-flash')
    steps.push('damage-number', 'monster-hp')
    damageText = `-${result.damage_dealt}`
  } else {
    steps.push('monster-attack')
    if (!reducedMotion) {
      steps.push('player-flash', 'camera-shake')
      shakeMs = SHAKE_MS
    }
  }

  if (result.monster_hp_remaining === 0) steps.push('monster-defeat', 'gate-open')

  return { steps, shakeMs, damageText }
}
