import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, getApi, type ApiClient } from '../api'
import type { LeaderboardPeriod, LeaderboardResponse } from '../types/api'
import { POLL_MS } from './constants'

export type LeaderboardStatus = 'loading' | 'ready' | 'error'

export interface UseLeaderboardOptions {
  dungeonId: string
  period: LeaderboardPeriod
  limit?: number
  /** False skips every request (the backend has no leaderboard). */
  enabled?: boolean
  /** Poll interval in ms. Default 30 s (D11); 0 fetches once without polling. */
  intervalMs?: number
  /** Test seam: supplies the client instead of `getApi()`. */
  getClient?: () => Promise<ApiClient>
}

export interface UseLeaderboardResult {
  status: LeaderboardStatus
  data: LeaderboardResponse | null
  /** First-load failure message (status `error`). */
  error: string | null
  /** True when the latest poll failed but older rows are still shown. */
  stale: boolean
  refresh(): void
}

const isVisible = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden'

/**
 * Leaderboard data (D11, Req 11.10 to 11.12): fetches on mount, then every 30 s only while the hook is
 * mounted and the tab is visible; refetches when the tab becomes visible again; clears its timer on
 * unmount. A failed poll keeps the old rows. No websockets.
 */
export function useLeaderboard({
  dungeonId,
  period,
  limit,
  enabled = true,
  intervalMs = POLL_MS,
  getClient = getApi,
}: UseLeaderboardOptions): UseLeaderboardResult {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [status, setStatus] = useState<LeaderboardStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [nonce, setNonce] = useState(0)
  const getClientRef = useRef(getClient)
  useEffect(() => {
    getClientRef.current = getClient
  })

  // A new board (another tab or dungeon) shows the skeleton again instead of the previous rows.
  const [boardKey, setBoardKey] = useState(`${dungeonId}|${period}`)
  const nextKey = `${dungeonId}|${period}`
  if (nextKey !== boardKey) {
    setBoardKey(nextKey)
    setData(null)
    setStatus('loading')
    setError(null)
    setStale(false)
  }

  // Whether the current board has loaded once. Reset (before the fetch effect) whenever the board changes.
  const hasData = useRef(false)
  useEffect(() => {
    hasData.current = false
  }, [dungeonId, period])

  const refresh = useCallback(() => {
    setStatus((s) => (s === 'error' ? 'loading' : s))
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    let seq = 0

    const load = async (): Promise<void> => {
      const mine = ++seq
      try {
        const api = await getClientRef.current()
        const next = await api.getLeaderboard({ dungeonId, period, ...(limit !== undefined ? { limit } : {}) })
        if (cancelled || mine !== seq) return
        hasData.current = true
        setData(next)
        setStatus('ready')
        setError(null)
        setStale(false)
      } catch (err) {
        if (cancelled || mine !== seq) return
        // Older rows stay on screen after a failed poll; only a first load becomes an error state.
        setStale(true)
        if (!hasData.current) {
          setStatus('error')
          setError(describeError(err, 'The leaderboard could not be loaded.'))
        }
      }
    }

    const stop = (): void => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    const start = (): void => {
      stop()
      if (intervalMs > 0 && isVisible()) timer = setInterval(() => void load(), intervalMs)
    }
    const onVisibility = (): void => {
      if (isVisible()) {
        void load()
        start()
      } else {
        stop()
      }
    }

    void load()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dungeonId, period, limit, enabled, intervalMs, nonce])

  return { status, data, error, stale, refresh }
}
