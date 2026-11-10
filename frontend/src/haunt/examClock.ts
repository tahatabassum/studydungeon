/** Pure Exam timer math. The component keeps a deadline and asks these functions what to show and say. */

export type Milestone = 'five' | 'one'

export const MILESTONE_SECONDS: Readonly<Record<Milestone, number>> = { five: 300, one: 60 }

export const MILESTONE_TEXT: Readonly<Record<Milestone, string>> = {
  five: '5 minutes left in the exam',
  one: '1 minute left in the exam',
}

/** Whole seconds left, never below 0. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))
}

/** `mm:ss`. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The announcement to make when the clock moves from `previous` to `current` seconds left, or null.
 * Only the 5-minute and 1-minute marks are announced; if both are crossed in one step (a throttled tab)
 * the closer one wins.
 */
export function milestoneCrossed(previous: number, current: number): Milestone | null {
  if (previous > MILESTONE_SECONDS.one && current <= MILESTONE_SECONDS.one) return 'one'
  if (previous > MILESTONE_SECONDS.five && current <= MILESTONE_SECONDS.five) return 'five'
  return null
}
