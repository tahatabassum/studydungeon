import { clampMastery } from './mastery'

/**
 * MOCK-ONLY mastery (D6): an exponential moving average per topic. The real Backend owns Mastery.
 * `m' = clamp(round(m + 0.3 * (target - m)), 0, 100)`, target 100 when correct, 0 when wrong.
 * A topic with no attempts starts at 50. A retry counts the same.
 */
export const MASTERY_ALPHA = 0.3
export const MASTERY_START = 50

export function updateMastery(current: number | undefined, correct: boolean): number {
  const m = clampMastery(current ?? MASTERY_START)
  const target = correct ? 100 : 0
  return clampMastery(Math.round(m + MASTERY_ALPHA * (target - m)))
}

export interface MasteryStore {
  record(topicId: string, correct: boolean): number
  /** Current mastery, or 0 when the topic has no attempts yet. */
  get(topicId: string): number
}

export function createMasteryStore(): MasteryStore {
  const values = new Map<string, number>()
  return {
    record(topicId, correct) {
      const next = updateMastery(values.get(topicId), correct)
      values.set(topicId, next)
      return next
    },
    get: (topicId) => values.get(topicId) ?? 0,
  }
}
