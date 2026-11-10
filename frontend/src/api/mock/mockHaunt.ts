import { HAUNT_CAP, selectDailyHaunt } from '../../haunt/hauntSelection'
import type { DueReview, DueReviewsResponse } from '../../types/api'

/**
 * MOCK-ONLY Daily Haunt (PROPOSED). Builds `{due_count, next_due_at, daily_streak, items}` from the
 * review store's due items (due now) and a simple schedule for answered-correct questions (due in a day).
 */
export const MOCK_REVIEW_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface HauntInputs {
  /** Reviews due now, in dungeon order (from the review store). */
  due: readonly DueReview[]
  /** Question id -> time (ms) the next review falls due, for questions answered correctly. */
  scheduled: ReadonlyMap<string, number>
  nowMs: number
  dailyStreak: number
  cap?: number
}

export function buildDueSummary(input: HauntInputs): DueReviewsResponse {
  const nowIso = new Date(input.nowMs).toISOString()
  const byId = new Map<string, DueReview>()
  const schedule = [
    ...input.due.map((r) => {
      byId.set(r.id, r)
      return { id: r.id, due_at: nowIso }
    }),
    ...[...input.scheduled.entries()].map(([qid, at]) => ({ id: `rev-${qid}`, due_at: new Date(at).toISOString() })),
  ]
  const { selected, next_due_at } = selectDailyHaunt(schedule, input.nowMs, input.cap ?? HAUNT_CAP)
  const items = selected.flatMap((s) => {
    const r = byId.get(s.id)
    return r ? [r] : []
  })
  return { due_count: input.due.length, next_due_at, daily_streak: input.dailyStreak, items }
}
