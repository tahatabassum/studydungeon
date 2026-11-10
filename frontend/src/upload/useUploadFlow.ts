import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, getApi, type ApiClient } from '../api'
import { rejectionMessage } from '../campaign/rejection'
import type { Dungeon, DocumentTopic } from '../types/api'
import { fileHint } from './limits'

/** How often a processing document is checked, and when to stop and offer "Check again". */
export const STATUS_POLL_MS = 2000
export const STATUS_TIMEOUT_MS = 3 * 60 * 1000

export type UploadPhase =
  | 'idle'
  | 'staged'
  | 'uploading'
  | 'processing'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'error'
  | 'summoning'
  | 'done'

export interface UploadFlow {
  phase: UploadPhase
  file: File | null
  /** A browser-side hint about the staged file. The server still decides. */
  hint: string | null
  topics: DocumentTopic[]
  /** Why the document was rejected or failed (the server's words). */
  reason: string | null
  /** A request error (quota, size, type, guests, network). */
  error: string | null
  dungeon: Dungeon | null
  /** True when processing took longer than the cap and polling stopped. */
  slow: boolean
  stage(file: File): void
  clear(): void
  start(): void
  retry(): void
  checkAgain(): void
  summon(): void
}

export interface UseUploadFlowOptions {
  pollMs?: number
  timeoutMs?: number
}

function failureText(err: unknown, fallback: string): string {
  return describeError(err, '') || rejectionMessage(err, fallback)
}

export function useUploadFlow({ pollMs = STATUS_POLL_MS, timeoutMs = STATUS_TIMEOUT_MS }: UseUploadFlowOptions = {}): UploadFlow {
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [topics, setTopics] = useState<DocumentTopic[]>([])
  const [reason, setReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dungeon, setDungeon] = useState<Dungeon | null>(null)
  const [slow, setSlow] = useState(false)
  const [docId, setDocId] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const apiRef = useRef<ApiClient | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const api = useCallback(async (): Promise<ApiClient> => {
    const client = apiRef.current ?? (await getApi())
    apiRef.current = client
    return client
  }, [])

  // While processing, ask the server for the verdict. Nothing is invented: the steps move when the server says so.
  useEffect(() => {
    if (phase !== 'processing' || docId === null) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let elapsed = 0
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const tick = async () => {
      if (stopped) return
      if (!hidden()) {
        if (elapsed >= timeoutMs) {
          setSlow(true)
          return
        }
        elapsed += pollMs
        try {
          const client = await api()
          const status = await client.getDocumentStatus(docId)
          if (stopped) return
          if (status.status === 'accepted') {
            const found = await client.getDocumentTopics(docId)
            if (stopped) return
            setTopics(found)
            setPhase('accepted')
            return
          }
          if (status.status === 'rejected' || status.status === 'failed') {
            setReason(status.rejection_reason)
            setPhase(status.status)
            return
          }
        } catch {
          // A failed check is tried again on the next tick.
        }
      }
      timer = setTimeout(() => void tick(), pollMs)
    }
    timer = setTimeout(() => void tick(), pollMs)
    return () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [phase, docId, pollMs, timeoutMs, epoch, api])

  const reset = useCallback(() => {
    setTopics([])
    setReason(null)
    setError(null)
    setDungeon(null)
    setSlow(false)
    setDocId(null)
  }, [])

  const stage = useCallback(
    (next: File) => {
      reset()
      setFile(next)
      setPhase('staged')
    },
    [reset],
  )

  const clear = useCallback(() => {
    reset()
    setFile(null)
    setPhase('idle')
  }, [reset])

  const start = useCallback(() => {
    if (!file || phase === 'uploading') return
    setError(null)
    setPhase('uploading')
    void (async () => {
      try {
        const client = await api()
        const sent = await client.uploadDocument(file)
        if (!mounted.current) return
        setDocId(sent.id)
        setSlow(false)
        setPhase('processing')
      } catch (err) {
        if (!mounted.current) return
        setError(failureText(err, 'The upload did not go through. Try again.'))
        setPhase('error')
      }
    })()
  }, [api, file, phase])

  const retry = useCallback(() => {
    if (docId === null) return
    setError(null)
    setReason(null)
    setSlow(false)
    void (async () => {
      try {
        const client = await api()
        await client.retryDocument(docId)
        if (!mounted.current) return
        setPhase('processing')
        setEpoch((n) => n + 1)
      } catch (err) {
        if (!mounted.current) return
        setError(failureText(err, 'That document could not be retried.'))
        setPhase('error')
      }
    })()
  }, [api, docId])

  const checkAgain = useCallback(() => {
    setSlow(false)
    setEpoch((n) => n + 1)
  }, [])

  const summon = useCallback(() => {
    if (docId === null || phase === 'summoning') return
    setError(null)
    setPhase('summoning')
    void (async () => {
      try {
        const client = await api()
        const created = await client.generateDungeon(docId)
        if (!mounted.current) return
        setDungeon(created)
        setPhase('done')
      } catch (err) {
        if (!mounted.current) return
        setError(failureText(err, 'The floors could not be summoned. Try again.'))
        setPhase('accepted')
      }
    })()
  }, [api, docId, phase])

  return {
    phase,
    file,
    hint: file ? fileHint(file) : null,
    topics,
    reason,
    error,
    dungeon,
    slow,
    stage,
    clear,
    start,
    retry,
    checkAgain,
    summon,
  }
}
