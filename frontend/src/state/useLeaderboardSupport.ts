import { useEffect, useState } from 'react'
import { getApi } from '../api'

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
