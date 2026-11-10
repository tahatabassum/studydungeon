import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Floor, FloorStatus, GenerationStatus } from '../types/api'

/** D19: poll every 2.5 s, pause on a hidden tab, stop at a terminal status, give up after 10 minutes. */
export const POLL_INTERVAL_MS = 2500
export const POLL_TIMEOUT_MS = 10 * 60 * 1000

/** Applies a status snapshot to the floors. Unknown floor ids are ignored. Pure. */
export function mergeStatuses(floors: readonly Floor[], status: GenerationStatus | null | undefined): Floor[] {
  if (!status) return [...floors]
  const byId = new Map(status.floors.map((f) => [f.id, f.status]))
  return floors.map((f) => {
    const next = byId.get(f.id)
    return next !== undefined && next !== f.status ? { ...f, status: next } : f
  })
}

/** Polite live-region sentences for the status changes between two snapshots. Pure. */
export function describeChanges(prev: ReadonlyMap<string, FloorStatus> | null, floors: readonly Floor[]): string[] {
  const out: string[] = []
  for (const f of floors) {
    const before = prev?.get(f.id)
    if (before === f.status) continue
    if (f.status === 'generating') out.push(`Floor ${f.index} is being summoned...`)
    else if (f.status === 'failed') out.push(`Floor ${f.index} could not be summoned. Retry is available.`)
    else if (before === 'generating' && (f.status === 'ready' || f.status === 'cleared')) {
      out.push(`Floor ${f.index} is ready.`)
    }
  }
  return out
}

export interface UseGenerationStatusOptions {
  floors: readonly Floor[]
  fetchStatus: () => Promise<GenerationStatus>
  intervalMs?: number
  timeoutMs?: number
}

export interface GenerationStatusView {
  floors: Floor[]
  /** Latest announcement for a polite live region. */
  announcement: string
  /** True after the 10 minute cap: show "taking longer than usual" and a Retry. */
  timedOut: boolean
  /** Starts polling again after a timeout. */
  resume(): void
}

export function useGenerationStatus({
  floors,
  fetchStatus,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = POLL_TIMEOUT_MS,
}: UseGenerationStatusOptions): GenerationStatusView {
  const [snapshot, setSnapshot] = useState<{ base: readonly Floor[]; status: GenerationStatus | null }>({
    base: floors,
    status: null,
  })
  const [timedOut, setTimedOut] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const fetchRef = useRef(fetchStatus)
  const prevRef = useRef<Map<string, FloorStatus> | null>(null)

  useEffect(() => {
    fetchRef.current = fetchStatus
  })

  // Fresh floors from the parent (a refetch) replace any older snapshot.
  const current = snapshot.base === floors ? snapshot.status : null
  const merged = useMemo(() => mergeStatuses(floors, current), [floors, current])
  const anyGenerating = merged.some((f) => f.status === 'generating')

  useEffect(() => {
    const messages = describeChanges(prevRef.current, merged)
    prevRef.current = new Map(merged.map((f) => [f.id, f.status]))
    if (messages.length > 0) setAnnouncement(messages.join(' '))
  }, [merged])

  useEffect(() => {
    if (!anyGenerating) return
    let stopped = false
    let elapsed = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const schedule = () => {
      if (!stopped) timer = setTimeout(() => void tick(), intervalMs)
    }
    const tick = async () => {
      if (stopped) return
      if (hidden()) {
        schedule()
        return
      }
      if (elapsed >= timeoutMs) {
        setTimedOut(true)
        setAnnouncement('Generation is taking longer than usual.')
        return
      }
      elapsed += intervalMs
      try {
        const status = await fetchRef.current()
        if (!stopped) setSnapshot({ base: floors, status })
      } catch {
        // A failed poll is retried on the next tick.
      }
      schedule()
    }
    const onVisible = () => {
      if (!hidden() && timer !== null) {
        clearTimeout(timer)
        timer = null
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    schedule()
    return () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [anyGenerating, floors, intervalMs, timeoutMs, epoch])

  const resume = useCallback(() => {
    setTimedOut(false)
    setEpoch((n) => n + 1)
  }, [])

  return { floors: merged, announcement, timedOut, resume }
}
