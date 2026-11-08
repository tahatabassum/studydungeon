import type { AnswerResult } from '@/types/api'

/** Sub-state of an Encounter (combat flow). */
export type CombatState =
  | 'starting'
  | 'question'
  | 'submitting'
  | 'result'
  | 'next'
  | 'monster_defeated'
  | 'player_defeated'
  | 'exited'

export const READ_DELAY_CORRECT_MS = 1200
export const READ_DELAY_WRONG_MS = 2000

/** How long the result is shown before moving on. */
export function readDelayMs(correct: boolean): number {
  return correct ? READ_DELAY_CORRECT_MS : READ_DELAY_WRONG_MS
}

/** False for null and 'exited'; true for every other state. */
export function isCombatActive(c: CombatState | null): boolean {
  return c !== null && c !== 'exited'
}

/** Retreat is only available while a question is awaiting an answer. */
export function canRetreat(c: CombatState | null): boolean {
  return c === 'question'
}

/** Answers are only accepted while a question is awaiting an answer. */
export function canAnswer(c: CombatState | null): boolean {
  return c === 'question'
}

/**
 * DISPLAY ONLY. This is not a combat calculation: the backend has already
 * applied the damage and returned the remaining HP. This merely derives the
 * amount lost for the UI, clamped at 0 (e.g. when HP did not decrease).
 */
export function damageReceived(prevPlayerHp: number, result: AnswerResult): number {
  return Math.max(0, prevPlayerHp - result.player_hp_remaining)
}
