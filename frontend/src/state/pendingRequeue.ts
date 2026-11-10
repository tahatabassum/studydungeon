/**
 * Display-side bookkeeping for the second chance (D5). The Backend (or the mock) decides whether a missed
 * question returns and after how many further questions (`requeue_after`); this only counts that
 * number down and says when the question is due. It never computes a gap of its own.
 */
export interface PendingRequeue {
  questionId: string
  /** Further questions to ask before this one returns; 0 means it is next. */
  remaining: number
}

/** Adds the response's gap for a question; a repeat for the same question replaces the earlier entry. */
export function addPending(list: readonly PendingRequeue[], questionId: string, requeueAfter: number): PendingRequeue[] {
  const rest = list.filter((p) => p.questionId !== questionId)
  return [...rest, { questionId, remaining: Math.max(0, Math.floor(requeueAfter)) }]
}

/** The entry that is due now (the one waiting longest), or undefined. */
export function duePending(list: readonly PendingRequeue[]): PendingRequeue | undefined {
  return list.find((p) => p.remaining <= 0)
}

/** One ordinary question was presented: every other entry is one question closer. `returned` leaves the list. */
export function tickPending(list: readonly PendingRequeue[], returned?: string): PendingRequeue[] {
  return list
    .filter((p) => p.questionId !== returned)
    .map((p) => ({ ...p, remaining: Math.max(0, p.remaining - 1) }))
}

export function removePending(list: readonly PendingRequeue[], questionId: string): PendingRequeue[] {
  return list.filter((p) => p.questionId !== questionId)
}

/** Further questions until the next return, or null when nothing is waiting. */
export function nextReturnIn(list: readonly PendingRequeue[]): number | null {
  if (list.length === 0) return null
  return Math.min(...list.map((p) => p.remaining))
}
