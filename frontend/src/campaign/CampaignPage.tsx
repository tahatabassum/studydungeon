import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { describeError, getApi, type ApiClient } from '../api'
import { Spinner } from '../components/Spinner'
import type { Dungeon, FinalBoss, Floor } from '../types/api'
import { DailyHauntButton } from '../haunt/DailyHauntButton'
import { ModePickerButton } from '../haunt/ModePickerButton'
import { FloorMap } from './FloorMap'
import { rejectionMessage } from './rejection'
import { campaignView } from './floorRooms'
import { useGenerationStatus } from './useGenerationStatus'

const NO_FLOORS: Floor[] = []

export function playPath(dungeonId: string, floorId: string): string {
  return `/campaign/${encodeURIComponent(dungeonId)}/play/${encodeURIComponent(floorId)}`
}

/**
 * `/campaign/:dungeonId`: the floor map. It loads the dungeon on every visit, so returning from a
 * floor shows the updated statuses, ranks and mastery.
 */
export default function CampaignPage() {
  const { dungeonId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const apiRef = useRef<ApiClient | null>(null)
  const [dungeon, setDungeon] = useState<Dungeon | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [extras, setExtras] = useState(true)
  const [message, setMessage] = useState<string | null>(
    () => (location.state as { startError?: string } | null)?.startError ?? null,
  )

  // The start error arrived through router state: keep it on screen but out of the history entry.
  useEffect(() => {
    if ((location.state as { startError?: string } | null)?.startError) {
      navigate(location.pathname, { replace: true, state: null })
    }
    // Runs once for the entry that carried the message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every visit (and every reload request) fetches the dungeon again, so the map is never stale.
  const [nonce, setNonce] = useState(0)
  const load = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const d = await api.getDungeon(dungeonId)
        if (cancelled) return
        apiRef.current = api
        setLoadError(null)
        // D26: a backend without floors shows its honest single floor and hides the campaign extras.
        setExtras(api.capabilities?.floors !== false)
        setDungeon(d)
      } catch (err) {
        if (!cancelled) setLoadError(describeError(err, 'The map could not be loaded.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dungeonId, nonce])

  const view = useMemo(() => (dungeon ? campaignView(dungeon) : null), [dungeon])
  const baseFloors = view?.floors ?? NO_FLOORS
  const finalBoss: FinalBoss | null = view?.final_boss ?? null

  const fetchStatus = useCallback(() => {
    const api = apiRef.current
    if (!api) return Promise.reject(new Error('The map is not loaded.'))
    return api.getGenerationStatus(dungeonId)
  }, [dungeonId])
  const generation = useGenerationStatus({ floors: baseFloors, fetchStatus })

  const openFloor = useCallback(
    (floor: Floor) => navigate(playPath(dungeonId, floor.id)),
    [dungeonId, navigate],
  )
  const openFinal = useCallback(
    (boss: FinalBoss) => navigate(playPath(dungeonId, boss.id)),
    [dungeonId, navigate],
  )
  const retryFloor = useCallback(
    async (floor: Floor) => {
      const api = apiRef.current
      if (!api) return
      setMessage(null)
      try {
        await api.retryFloor(floor.id)
        load()
      } catch (err) {
        setMessage(rejectionMessage(err, `Floor ${floor.index} could not be retried.`))
      }
    },
    [load],
  )

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <p role="alert">{loadError}</p>
        <div className="flex gap-4">
          <button type="button" className="sd-control rounded-lg border-2 border-magic px-4 py-2" onClick={load}>
            Try again
          </button>
          <Link to="/" className="self-center underline">
            Back to start
          </Link>
        </div>
      </main>
    )
  }

  if (!dungeon || !view) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-bg text-ink">
        <Spinner label="Opening the map..." />
        <span aria-hidden="true">Opening the map...</span>
      </main>
    )
  }

  return (
    <FloorMap
      title={view.name}
      floors={generation.floors}
      finalBoss={finalBoss}
      extras={extras}
      announcement={generation.announcement}
      errorMessage={message}
      onDismissError={() => setMessage(null)}
      timedOut={generation.timedOut}
      onResume={generation.resume}
      backTo="/"
      dashboardTo="/dashboard"
      onOpenFloor={openFloor}
      onOpenFinal={openFinal}
      onRetryFloor={(f) => void retryFloor(f)}
      headerTools={
        <>
          <DailyHauntButton dungeonId={dungeonId} compact />
          <ModePickerButton dungeonId={dungeonId} floors={generation.floors} />
        </>
      }
    />
  )
}
