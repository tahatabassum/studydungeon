import {
  BOSS_PROFILE,
  CRIT_AFTER_STREAK,
  INITIAL_STATE,
  ROOM_PROFILE,
  applyAnswer,
  roundHalfEven,
  strikeDamage,
  type RulesState,
} from '../demo/rules'
import { firstTryAccuracy, rankFor } from '../learning/rank'
import type { AnswerResult, FloorRank } from '../types/api'
import { DEFAULT_WEAPON } from '../weapons/weapons'

/**
 * Offline rules: the SAME balance as the Mock_Adapter (they share `src/demo/rules.ts`), wrapped into one
 * pure step. No randomness and no clock: the same inputs always give the same output (Req 14.5).
 */
export { INITIAL_STATE, type RulesState }

/** A second chance deals half damage and half XP (D21, PROPOSED). */
export const RETRY_MULTIPLIER = 0.5
export const ROOM_CLEAR_XP = 25
export const BOSS_CLEAR_XP = 100

export interface AttemptInput {
  state: RulesState
  correct: boolean
  /** The monster is the Final_Boss (wrong answers cost more). */
  isBoss: boolean
  /** A hard question deals x1.25 damage. */
  hard: boolean
  /** The question was missed earlier in this run. */
  isRetry: boolean
}

export interface AttemptOutcome {
  next: RulesState
  result: Omit<AnswerResult, 'source' | 'explanation'>
  critical: boolean
}

/** One answer: damage, HP, streak, score and XP. Offline always strikes with the Rusty Dagger. */
export function resolveAttempt(input: AttemptInput): AttemptOutcome {
  const critical = input.correct && input.state.streak >= CRIT_AFTER_STREAK
  const strike = strikeDamage(DEFAULT_WEAPON.baseDamage, input.hard, critical)
  const base = input.isBoss ? BOSS_PROFILE : ROOM_PROFILE
  const { next, result } = applyAnswer(input.state, input.correct, {
    ...base,
    weaponDamage: input.isRetry ? roundHalfEven(strike * RETRY_MULTIPLIER) : strike,
  })
  if (input.isRetry && result.xp_delta !== undefined) {
    result.xp_delta = roundHalfEven(result.xp_delta * RETRY_MULTIPLIER)
  }
  return { next, result, critical }
}

/** XP for clearing a room. */
export function clearXp(isBoss: boolean): number {
  return isBoss ? BOSS_CLEAR_XP : ROOM_CLEAR_XP
}

/** Floor rank from the distinct questions asked: first-try accuracy, and any retry blocks S. */
export function floorRankOf(firstTryCorrect: number, asked: number, retries: number): FloorRank {
  return rankFor(firstTryAccuracy(firstTryCorrect, asked), retries)
}
