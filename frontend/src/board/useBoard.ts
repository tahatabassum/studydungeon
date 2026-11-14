import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, getApi } from '../api'
import { ApiError } from '../api/errors'
import type { BoardKind, BoardResponse, LeaderboardPeriod } from '../types/api'
import { MIN_BOARD_INTERVAL_MS, nextPollDelay, randomJitter } from './pollScheduler'

export type BoardStatus = 'loading' | 'ready' | 'error'

export interface UseBoardResult {
  status: BoardStatus
  data: BoardResponse | null
  /** First-load failure message (status `error`). */
  error: string | null
  /** True when the latest refresh failed but older rows are still shown. */
  stale: boolean
  /** Retry now (a manual Retry still waits out a Retry-After window). */
  refresh(): void
}

const isVisible = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden'

/** End of a Retry-After window in ms, from the header (seconds or an HTTP date) or the body field; null when absent. */
export function retryAfterUntil(err: unknown, nowMs: number): number | null {
  if (!(err instanceof ApiError)) return null
  if (typeof err.retry_after_seconds === 'number') return nowMs + err.retry_after_seconds * 1000
  if (err.retryAfter) {
    const secs = Number(err.retryAfter)
    if (Number.isFinite(secs)) return nowMs + secs * 1000
    const at = Date.parse(err.retryAfter)
    if (!Number.isNaN(at)) return at
  }
  return null
}

/**
 * Live board data (D17/D18). One timer, scheduled by `nextPollDelay`: no request before `next_refresh_at`
 * plus jitter, never two within 60 s, nothing while the tab is hidden, and a refetch when it is visible
 * again after 60 s. A failed refresh keeps the old rows. Late responses (an older request, another tab,
 * after unmount) are ignored.
 */
export function useBoard(board: BoardKind, period: LeaderboardPeriod): UseBoardResult {
  const [state, setState] = useState<{ key: string; data: BoardResponse | null; error: string | null; stale: boolean }>({
    key: `${board}|${period}`,
    data: null,
    error: null,
    stale: false,
  })
  const key = `${board}|${period}`
  const ctl = useRef<{ refresh(): void }>({ refresh: () => undefined })

  useEffect(() => {
    let alive = true
    let seq = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastFetchAt: number | null = null
    let nextRefreshAt: number | null = null
    let retryUntil: number | null = null
    let hasData = false

    const clear = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const schedule = () => {
      clear()
      if (!alive) return
      const delay = nextPollDelay({
        now: Date.now(),
        nextRefreshAt,
        lastFetchAt,
        visible: isVisible(),
        retryAfterUntil: retryUntil,
        jitterMs: randomJitter(),
      })
      if (delay !== null) timer = setTimeout(() => void load(), delay)
    }
    const load = async () => {
      clear()
      const mine = ++seq
      lastFetchAt = Date.now()
      try {
        const api = await getApi()
        const res = await api.getBoard({ board, period })
        if (!alive || mine !== seq) return
        hasData = true
        nextRefreshAt = Date.parse(res.next_refresh_at)
        if (Number.isNaN(nextRefreshAt)) nextRefreshAt = null
        retryUntil = null
        setState({ key, data: res, error: null, stale: false })
      } catch (err) {
        if (!alive || mine !== seq) return
        retryUntil = retryAfterUntil(err, Date.now())
        setState((s) => ({ key, data: hasData ? s.data : null, error: describeError(err, 'The board could not be loaded. Try again.'), stale: hasData }))
      }
      schedule()
    }
    const onVisibility = () => {
      if (!isVisible()) return clear()
      const now = Date.now()
      if (lastFetchAt === null || (now - lastFetchAt >= MIN_BOARD_INTERVAL_MS && (retryUntil ?? 0) <= now)) void load()
      else schedule()
    }
    ctl.current = {
      refresh: () => {
        if ((retryUntil ?? 0) > Date.now()) return schedule()
        setState((s) => (s.data ? s : { ...s, error: null }))
        void load()
      },
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (isVisible()) void load()
    return () => {
      alive = false
      seq += 1
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [board, period, key])

  const refresh = useCallback(() => ctl.current.refresh(), [])
  // A state from another board is never shown: the new board starts on its skeleton.
  const current = state.key === key ? state : { key, data: null, error: null, stale: false }
  const status: BoardStatus = current.data ? 'ready' : current.error ? 'error' : 'loading'
  return { status, data: current.data, error: current.error, stale: current.stale, refresh }
}
