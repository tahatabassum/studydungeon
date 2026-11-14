import { useEffect, useState } from 'react'
import { getApi } from '../api'
import { capabilityOf, type ApiClient } from '../api/ApiClient'

export type LeaderboardSupport = 'unknown' | 'yes' | 'no'

/**
 * Whether the active client supports the leaderboard (D26). A client without `capabilities` supports
 * everything (the mock). The real backend has no leaderboard endpoint, so it answers `no` and the UI shows a
 * "coming soon" state instead of calling it.
 */
export function useLeaderboardSupport(): LeaderboardSupport {
  const [support, setSupport] = useState<LeaderboardSupport>('unknown')
  useEffect(() => {
    let cancelled = false
    void getApi()
      .then((api) => {
        if (!cancelled) setSupport(api.capabilities?.leaderboard === false ? 'no' : 'yes')
      })
      .catch(() => {
        if (!cancelled) setSupport('no')
      })
    return () => {
      cancelled = true
    }
  }, [])
  return support
}

/** frontend-10 (D16): which leaderboard the page shows. */
export type LeaderboardView = 'unknown' | 'live' | 'legacy' | 'soon'

/** Live when `liveBoard` is not off; else legacy when the old `leaderboard` capability is not false; else soon. */
export function leaderboardViewOf(api: Pick<ApiClient, 'capabilities'>): Exclude<LeaderboardView, 'unknown'> {
  if (capabilityOf(api, 'liveBoard') !== 'off') return 'live'
  return api.capabilities?.leaderboard === false ? 'soon' : 'legacy'
}

export function useLeaderboardView(): LeaderboardView {
  const [view, setView] = useState<LeaderboardView>('unknown')
  useEffect(() => {
    let cancelled = false
    void getApi()
      .then((api) => {
        if (!cancelled) setView(leaderboardViewOf(api))
      })
      .catch(() => {
        if (!cancelled) setView('soon')
      })
    return () => {
      cancelled = true
    }
  }, [])
  return view
}
