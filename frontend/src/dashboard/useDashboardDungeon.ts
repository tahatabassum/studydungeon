import { useCallback, useEffect, useMemo, useState } from 'react'
import { describeError, getApi } from '../api'
import { campaignView } from '../campaign/floorRooms'
import { nextPlayable, type PlayTarget } from '../campaign/floorLayout'
import type { Dungeon, FinalBoss, Floor } from '../types/api'

export type DashboardDungeonStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DashboardDungeon {
  status: DashboardDungeonStatus
  name: string
  floors: readonly Floor[]
  finalBoss: FinalBoss | null
  /** The campaign map's next playable floor (the Continue target), or null. */
  next: PlayTarget | null
  /** False for a backend without floors: the single legacy Floor is all there is. */
  campaign: boolean
  error: string | null
  retry(): void
}

const NONE: readonly Floor[] = []

/** The dungeon as the Dashboard needs it: floors with topic mastery, and where Continue goes. */
export function useDashboardDungeon(dungeonId: string | null): DashboardDungeon {
  const [dungeon, setDungeon] = useState<Dungeon | null>(null)
  const [campaign, setCampaign] = useState(true)
  const [status, setStatus] = useState<DashboardDungeonStatus>(dungeonId ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!dungeonId) return
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const d = await api.getDungeon(dungeonId)
        if (cancelled) return
        setCampaign(api.capabilities?.floors !== false)
        setDungeon(d)
        setError(null)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(describeError(err, 'The dungeon could not be loaded.'))
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dungeonId, nonce])

  const view = useMemo(() => (dungeon ? campaignView(dungeon) : null), [dungeon])
  const floors = view?.floors ?? NONE
  const finalBoss = campaign ? (view?.final_boss ?? null) : null
  const next = useMemo(() => nextPlayable(floors, finalBoss), [floors, finalBoss])

  const retry = useCallback(() => {
    setStatus('loading')
    setNonce((n) => n + 1)
  }, [])

  return {
    status: dungeonId ? (status === 'idle' ? 'loading' : status) : 'idle',
    name: view?.name ?? '',
    floors,
    finalBoss,
    next,
    campaign,
    error,
    retry,
  }
}
