import { useCallback, useEffect, useState } from 'react'

export interface RetryAfter {
  /** Seconds left; 0 when submit is allowed. */
  remaining: number
  /** Starts (or restarts) the countdown. */
  start: (seconds: number) => void
}

/** Counts down once per second so the forms can keep submit disabled for a 429's Retry-After. */
export function useRetryAfter(): RetryAfter {
  const [remaining, setRemaining] = useState(0)
  const active = remaining > 0

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [active])

  const start = useCallback((seconds: number) => setRemaining(Math.max(0, Math.floor(seconds))), [])
  return { remaining, start }
}
