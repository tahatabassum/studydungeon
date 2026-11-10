import { useCallback, useEffect, useState } from 'react'
import { describeError, getApi } from '../api'
import type { ProgressInfo } from '../types/api'

export type ProgressStatus = 'loading' | 'ready' | 'error'

export interface UseProgressResult {
  status: ProgressStatus
  progress: ProgressInfo | null
  error: string | null
  retry(): void
}

/** Loads `GET /progress` once per mount (and again on retry). Never throws; failures become `status: 'error'`. */
export function useProgress(): UseProgressResult {
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [status, setStatus] = useState<ProgressStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const p = await api.getProgress()
        if (cancelled) return
        setProgress(p)
        setError(null)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(describeError(err, 'Your progress could not be loaded.'))
        setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nonce])

  const retry = useCallback(() => {
    setStatus('loading')
    setNonce((n) => n + 1)
  }, [])

  return { status, progress, error, retry }
}
