/** Never two requests for one board and period less than this apart (V2 D, B-to-A section 5). */
export const MIN_BOARD_INTERVAL_MS = 60_000
/** Random extra wait after `next_refresh_at`, 0 to this many ms, to avoid a thundering herd. */
export const REFETCH_JITTER_MS = 2_000

export interface PollState {
  now: number
  /** `next_refresh_at` of the last response, ms; null before the first response. */
  nextRefreshAt: number | null
  /** When the last request started, ms; null on a first load. */
  lastFetchAt: number | null
  visible: boolean
  /** End of a Retry-After window, ms; null when none. */
  retryAfterUntil?: number | null
  /** 0 to REFETCH_JITTER_MS. */
  jitterMs?: number
}

export function randomJitter(rng: () => number = Math.random): number {
  return Math.floor(rng() * (REFETCH_JITTER_MS + 1))
}

/**
 * Milliseconds until the next poll, or null when the tab is hidden (nothing is polled then).
 * The poll time is the latest of: next_refresh_at plus jitter, last fetch plus 60 s, the Retry-After end.
 */
export function nextPollDelay(s: PollState): number | null {
  if (!s.visible) return null
  const retry = s.retryAfterUntil ?? 0
  if (s.lastFetchAt === null) return Math.max(0, retry - s.now)
  const jitter = Math.min(REFETCH_JITTER_MS, Math.max(0, s.jitterMs ?? 0))
  const refresh = s.nextRefreshAt === null ? 0 : s.nextRefreshAt + jitter
  const at = Math.max(refresh, s.lastFetchAt + MIN_BOARD_INTERVAL_MS, retry)
  return Math.max(0, at - s.now)
}
