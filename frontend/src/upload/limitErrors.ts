import { ApiError, describeError } from '../api'
import { rejectionMessage } from '../campaign/rejection'
import { UPLOAD_LIMITS } from './limits'

const n = (v: number): string => v.toLocaleString('en-US')

/**
 * Words a per-type limit error with BOTH numbers: "This PDF has 42 pages; the limit is 30."
 * `found` is what the server counted; when it is missing the text says so without inventing a number.
 * The limit falls back to the constants module. Returns null for any other code.
 */
export function describeLimitError(code: string | undefined, extra: { limit?: number; found?: number } = {}): string | null {
  const spec: Record<string, { subject: string; unit: string; fallback: number }> = {
    TOO_MANY_PAGES: { subject: 'PDF', unit: 'pages', fallback: UPLOAD_LIMITS.maxPdfPages },
    TOO_MANY_SLIDES: { subject: 'presentation', unit: 'slides', fallback: UPLOAD_LIMITS.maxSlides },
    TOO_MUCH_TEXT: { subject: 'document', unit: 'characters', fallback: UPLOAD_LIMITS.maxDocxChars },
  }
  const s = code !== undefined && Object.hasOwn(spec, code) ? spec[code] : undefined
  if (!s) return null
  const limit = extra.limit ?? s.fallback
  const has = extra.found === undefined ? 'has too many' : `has ${n(extra.found)}`
  return `This ${s.subject} ${has} ${s.unit}; the limit is ${n(limit)}.`
}

/** "about 5 minutes" from a wait in seconds. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return 'less than a minute'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  const hours = Math.ceil(minutes / 60)
  return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

function waitSeconds(err: ApiError): number | null {
  if (typeof err.retry_after_seconds === 'number') return err.retry_after_seconds
  if (err.retryAfter && /^\d+$/.test(err.retryAfter)) return Number(err.retryAfter)
  return null
}

/** Player-facing text for an upload failure: limit numbers, Retry-After, then the friendly code message. */
export function describeUploadError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const limit = describeLimitError(err.code, {
      ...(err.limit !== undefined ? { limit: err.limit } : {}),
      ...(err.found !== undefined ? { found: err.found } : {}),
    })
    if (limit) return limit
    const base = describeError(err, '')
    if (base && (err.code === 'UPLOAD_LIMIT_PLAYER' || err.code === 'UPLOAD_LIMIT_IP' || err.code === 'AI_BUSY' || err.status === 429)) {
      const wait = waitSeconds(err)
      return wait === null ? base : `${base} Try again in ${formatWait(wait)}.`
    }
    if (base) return base
  }
  return describeError(err, '') || rejectionMessage(err, fallback)
}

/** True for the codes where the Backend offers the preloaded dungeons instead. */
export function isBusyError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'AI_BUSY' || err.offer_packs === true)
}
