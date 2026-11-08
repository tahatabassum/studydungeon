import { z } from 'zod'
import type { AnswerResult } from '../../types/api'

/** `POST /runs/{id}/attempts` (AttemptResponse, C10). */
export const wireAttemptSchema = z.object({
  attempt_id: z.string().optional(),
  is_correct: z.boolean(),
  damage_dealt: z.number().int().nonnegative(),
  damage_taken: z.number().int().nonnegative(),
  is_critical: z.boolean(),
  current_hp: z.number().int().nonnegative(),
  current_score: z.number().int().nonnegative(),
  current_streak: z.number().int().nonnegative(),
  monster_hp_remaining: z.number().int().nonnegative(),
  explanation: z.string().nullish(),
  evidence_quote: z.string().nullish(),
})

export type WireAttempt = z.output<typeof wireAttemptSchema>

/** Values the Http_Client knows from earlier responses and passes in (the wire does not carry them). */
export interface AttemptContext {
  /** Monster HP after this strike. The wire's `monster_hp_remaining` is not reliable (the backend sends 0). */
  monsterHpRemaining: number
  /** Difference between this `current_score` and the last one seen for the run (display only). */
  scoreDelta: number
  /** Weapon sent with the request; the response does not name one. */
  weaponId: string
}

/**
 * C10: is_correct to correct, current_hp to player_hp_remaining, current_streak to streak.
 * There is no xp_delta (HUD XP comes from clear, finish and progress) and no source page.
 */
export function mapAttempt(w: WireAttempt, ctx: AttemptContext): AnswerResult {
  return {
    correct: w.is_correct,
    damage_dealt: w.damage_dealt,
    monster_hp_remaining: ctx.monsterHpRemaining,
    player_hp_remaining: w.current_hp,
    score_delta: ctx.scoreDelta,
    streak: w.current_streak,
    weapon_id: ctx.weaponId,
    is_critical: w.is_critical,
    ...(w.explanation ? { explanation: w.explanation } : {}),
    ...(w.evidence_quote ? { evidence_quote: w.evidence_quote } : {}),
  }
}
