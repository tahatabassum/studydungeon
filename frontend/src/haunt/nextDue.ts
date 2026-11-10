const MIN_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/**
 * "3 h", "25 min", "2 days": how long until the next review falls due. Rounds to the nearest unit and
 * never claims less than one. Pure.
 */
export function nextDuePhrase(nextDueAt: string, nowMs: number): string | null {
  const at = Date.parse(nextDueAt)
  if (!Number.isFinite(at)) return null
  const diff = at - nowMs
  if (diff < MIN_MS) return 'under a minute'
  if (diff < HOUR_MS) return `${Math.max(1, Math.round(diff / MIN_MS))} min`
  if (diff < 2 * DAY_MS) return `${Math.max(1, Math.round(diff / HOUR_MS))} h`
  return `${Math.round(diff / DAY_MS)} days`
}

/**
 * The line under the celebration when nothing is due. Honest: it states a time only when the Backend
 * sent one, and says so when nothing is scheduled.
 */
export function nextDueText(nextDueAt: string | null, nowMs: number): string {
  if (nextDueAt === null) return 'No memory is scheduled yet. Play a floor to plant some.'
  const phrase = nextDuePhrase(nextDueAt, nowMs)
  return phrase === null ? 'No memory is scheduled yet. Play a floor to plant some.' : `Next memory stirs in ${phrase}`
}
