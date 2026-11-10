import { useEffect, useState } from 'react'

export const COUNT_UP_MS = 1000
const TICK_MS = 40

/**
 * Value shown `elapsedMs` into a count-up from 0 to `target` (pure, Req 10.1, 10.9). Ease-out cubic.
 * Non-decreasing in time, never above the target, exactly the target at or after `durationMs`, and the
 * target at once when `reduced`. `target` is a score or XP: non-negative.
 */
export function countUpValue(target: number, elapsedMs: number, durationMs: number = COUNT_UP_MS, reduced = false): number {
  const end = Number.isFinite(target) ? Math.max(0, target) : 0
  if (reduced || durationMs <= 0 || elapsedMs >= durationMs) return end
  if (elapsedMs <= 0) return 0
  const t = elapsedMs / durationMs
  const eased = 1 - (1 - t) ** 3
  return Math.min(end, Math.round(end * eased))
}

export interface CountUpOptions {
  reduced: boolean
  durationMs?: number
  /** Wait this long before counting. */
  delayMs?: number
  /** False holds the value at 0 (for example while the data is still loading). */
  active?: boolean
}

/** Counts from 0 to `target`; instant under Reduced_Motion. Time advances by fixed ticks (no clock reads). */
export function useCountUp(target: number, { reduced, durationMs = COUNT_UP_MS, delayMs = 0, active = true }: CountUpOptions): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (reduced || !active) return
    const total = durationMs + delayMs
    let ms = 0
    const id = setInterval(() => {
      ms += TICK_MS
      setElapsed(ms)
      if (ms >= total) clearInterval(id)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [reduced, active, durationMs, delayMs])
  if (reduced) return countUpValue(target, 0, durationMs, true)
  if (!active) return 0
  return countUpValue(target, elapsed - delayMs, durationMs)
}

/**
 * Rank reveal: the displayed rank slides down from `from` to the final rank. It reuses `countUpValue`, so it
 * is monotone (never rises) and ends exactly on `rank`.
 */
export function rankRevealValue(rank: number, from: number, elapsedMs: number, durationMs: number = COUNT_UP_MS, reduced = false): number {
  const start = Math.max(rank, from)
  return start - countUpValue(start - rank, elapsedMs, durationMs, reduced)
}
