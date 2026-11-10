import type { AnswerResult } from '../types/api'

/**
 * DISPLAY ONLY (D21). The Backend (or the mock) has already applied the retry multiplier to damage
 * and XP; this only words the value it sent. Nothing here multiplies, rounds or derives a reward.
 */
export function retryEffectLabel(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return ''
  if (multiplier === 1) return 'full damage'
  if (multiplier === 0.5) return 'half damage'
  if (multiplier === 0) return 'no damage'
  return `${Math.round(multiplier * 100)} percent damage`
}

/**
 * The line shown on a second-chance result, or null when the response says nothing about a retry.
 * `Retry: half damage` comes from `retry_multiplier`; without it the line is just `Second chance`.
 */
export function retryNote(result: Pick<AnswerResult, 'is_retry' | 'retry_multiplier'>): string | null {
  if (result.is_retry !== true) return null
  if (typeof result.retry_multiplier !== 'number') return 'Second chance'
  const effect = retryEffectLabel(result.retry_multiplier)
  return effect ? `Retry: ${effect}` : 'Second chance'
}
