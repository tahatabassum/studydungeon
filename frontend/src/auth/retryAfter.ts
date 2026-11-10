/** Seconds to wait when a 429 carries no usable Retry-After header. */
export const DEFAULT_RETRY_AFTER_S = 10
/** Upper bound so a bad header cannot lock the form for hours. */
export const MAX_RETRY_AFTER_S = 3600

/**
 * Seconds to wait from a `Retry-After` header: whole seconds, or an HTTP date relative to `nowMs`.
 * Missing, empty, zero, negative or unreadable values give the 10 s default (Req 13.7).
 */
export function parseRetryAfter(value: string | null | undefined, nowMs: number = Date.now()): number {
  if (value === null || value === undefined) return DEFAULT_RETRY_AFTER_S
  const text = value.trim()
  if (text === '') return DEFAULT_RETRY_AFTER_S
  if (/^\d+$/.test(text)) {
    const seconds = Number(text)
    return seconds > 0 ? Math.min(seconds, MAX_RETRY_AFTER_S) : DEFAULT_RETRY_AFTER_S
  }
  const at = Date.parse(text)
  if (Number.isNaN(at)) return DEFAULT_RETRY_AFTER_S
  const seconds = Math.ceil((at - nowMs) / 1000)
  return seconds > 0 ? Math.min(seconds, MAX_RETRY_AFTER_S) : DEFAULT_RETRY_AFTER_S
}
