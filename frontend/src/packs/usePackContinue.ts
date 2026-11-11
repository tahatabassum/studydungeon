import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import type { Pack, PacksResponse, RunSummary } from '../types/api'
import { unlockedBetween } from './packView'

/** Where Continue goes after a final boss clear: `pack_progress` first, else the diff of two pack lists. Null means the map. */
export function packDestination(
  summary: Pick<RunSummary, 'pack_progress'>,
  before: Pick<PacksResponse, 'packs' | 'all_completed'> | null,
  after: Pick<PacksResponse, 'packs' | 'all_completed'> | null,
): string | null {
  const progress = summary.pack_progress
  if (progress) {
    if (progress.unlocked_pack_id) return `/packs/unlocked/${encodeURIComponent(progress.unlocked_pack_id)}`
    return progress.all_completed ? '/packs/complete' : null
  }
  if (!before || !after) return null
  const [next] = unlockedBetween(before.packs as readonly Pack[], after.packs as readonly Pack[])
  if (next) return `/packs/unlocked/${encodeURIComponent(next.id)}`
  return after.all_completed && !before.all_completed ? '/packs/complete' : null
}

/**
 * Scorecard Continue for a final boss clear. Returns null when there is nothing pack related to continue to.
 * `fallback` is where to go when no pack was unlocked (the floor map).
 */
export function usePackContinue(summary: RunSummary | null, isFinal: boolean, fallback: () => void): (() => void) | null {
  const navigate = useNavigate()
  const beforeRef = useRef<PacksResponse | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!isFinal) return
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        if (capabilityOf(api, 'packs') === 'off') return
        const res = await api.getPacks()
        if (cancelled) return
        beforeRef.current = res
        setReady(true)
      } catch {
        // No packs: no Continue.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFinal])

  const onContinue = useCallback(() => {
    void (async () => {
      let go: string | null
      if (summary?.pack_progress) {
        go = packDestination(summary, null, null)
      } else {
        const after = await getApi()
          .then((api) => api.getPacks())
          .catch(() => null)
        go = summary ? packDestination(summary, beforeRef.current, after) : null
      }
      if (go) navigate(go)
      else fallback()
    })()
  }, [summary, fallback, navigate])

  if (!isFinal || !summary) return null
  return summary.pack_progress || ready ? onContinue : null
}
