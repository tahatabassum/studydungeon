import { useCallback, useEffect, useState } from 'react'
import { describeError, getApi } from '../api'
import type { DueReviewsResponse } from '../types/api'

export type DailyHauntState =
  | { status: 'loading' }
  /** D26: this backend cannot build a Daily Haunt (real mode, the offline demo). */
  | { status: 'unsupported' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: DueReviewsResponse; nowMs: number }

/** What the Daily Haunt button and page know: the due count, the next due time and the streak, all from the Backend. */
export function useDailyHaunt(): DailyHauntState & { retry(): void } {
  const [state, setState] = useState<DailyHauntState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        if (api.capabilities?.dailyHaunt === false) {
          if (!cancelled) setState({ status: 'unsupported' })
          return
        }
        const summary = await api.getDueReviews()
        if (!cancelled) setState({ status: 'ready', summary, nowMs: Date.now() })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: describeError(err, 'Your memories could not be checked.') })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nonce])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setNonce((n) => n + 1)
  }, [])

  return { ...state, retry }
}
