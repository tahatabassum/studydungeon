/** Seconds left until `targetMs`, rounded up, never negative. */
export function remainingSeconds(targetMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000))
}

/** `h:mm:ss` from one hour up, otherwise `m:ss`; `0:00` at or after the target. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const total = remainingSeconds(targetMs, nowMs)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function formatIn(date: Date, timeZone: string | undefined, withZoneName: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    ...(timeZone !== undefined ? { timeZone } : {}),
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(withZoneName ? { timeZoneName: 'short' as const } : {}),
  }).format(date)
}

/** Formats in a zone; an invalid IANA zone falls back to UTC. */
function safeFormat(date: Date, timeZone: string | undefined, withZoneName: boolean): string {
  try {
    return formatIn(date, timeZone, withZoneName)
  } catch {
    return formatIn(date, 'UTC', withZoneName)
  }
}

/**
 * "Resets Monday 00:00 UTC (your time: Monday 02:00 GMT+2)" from `week.resets_at` and `week.timezone`.
 * `localZone` is the viewer's zone (the system zone when omitted).
 */
export function formatWeekReset(week: { timezone: string; resets_at: string }, localZone?: string): string {
  const at = new Date(week.resets_at)
  if (Number.isNaN(at.getTime())) return ''
  const main = safeFormat(at, week.timezone, true).replace(',', '')
  const local = safeFormat(at, localZone, true).replace(',', '')
  return main === local ? `Resets ${main}` : `Resets ${main} (your time: ${local})`
}
