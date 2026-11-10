import type { FloorRank } from '../types/api'

/**
 * MOCK-ONLY scoring decision (D7, PROPOSED to Person A). The real rank arrives as `floor_rank`.
 * S: first-try accuracy at least 0.90 with no retry. A: at least 0.80. B: at least 0.60. Otherwise C.
 */
export const RANK_S_AT = 0.9
export const RANK_A_AT = 0.8
export const RANK_B_AT = 0.6

/** Correct answers that were not retries divided by distinct questions. Zero questions give 0. */
export function firstTryAccuracy(correctFirstTry: number, distinctQuestions: number): number {
  if (distinctQuestions <= 0) return 0
  return Math.min(1, Math.max(0, correctFirstTry / distinctQuestions))
}

export function rankFor(accuracy: number, retries = 0): FloorRank {
  if (accuracy >= RANK_S_AT && retries === 0) return 'S'
  if (accuracy >= RANK_A_AT) return 'A'
  if (accuracy >= RANK_B_AT) return 'B'
  return 'C'
}

/** Higher is better; used to compare ranks. */
export const RANK_VALUE: Record<FloorRank, number> = { S: 3, A: 2, B: 1, C: 0 }
