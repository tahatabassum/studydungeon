import { ApiError } from '../errors'
import type { QuotaReason, UploadQuota } from '../../types/api'

/**
 * MOCK-ONLY upload quota (frontend-10, PROPOSED V2 G). Guests get 1 upload per day and keep 2 documents;
 * registered players get 10 per day and keep 5.
 *
 * DEV SWITCHES (dev builds only, query param wins over env):
 *  - `?mockQuota=<reason>` or `VITE_MOCK_QUOTA=<reason>`: force a blocked quota. <reason> is one of
 *    player_daily_limit, ip_daily_limit, stored_limit, global_daily_limit, ai_unavailable.
 *  - `?mockAiBusy=1` or `VITE_MOCK_AI_BUSY=true`: every upload answers 503 AI_BUSY with offer_packs.
 */
export const MOCK_GUEST_UPLOADS_PER_DAY = 1
export const MOCK_GUEST_STORED_LIMIT = 2
export const MOCK_PLAYER_UPLOADS_PER_DAY = 10
export const MOCK_PLAYER_STORED_LIMIT = 5
/** Notes shorter than this still work but do not count for the ranking. */
export const MOCK_RANKING_MIN_CHARS = 3000
export const MOCK_RANKING_MIN_TOPICS = 2
const DAY_SECONDS = 24 * 60 * 60

export const QUOTA_REASONS: readonly QuotaReason[] = [
  'player_daily_limit',
  'ip_daily_limit',
  'stored_limit',
  'global_daily_limit',
  'ai_unavailable',
]

export interface MockQuotaSwitches {
  forced?: QuotaReason
  aiBusy?: boolean
}

/** Reads the dev switches from a query string and env values. Everything is off outside dev. */
export function parseMockQuotaSwitches(search: string, env: { quota?: string; aiBusy?: string }, dev: boolean): MockQuotaSwitches {
  if (!dev) return {}
  const params = new URLSearchParams(search)
  const rawQuota = params.get('mockQuota') ?? env.quota
  const forced = QUOTA_REASONS.find((r) => r === rawQuota)
  const busyRaw = params.get('mockAiBusy') ?? env.aiBusy
  const aiBusy = busyRaw === '1' || busyRaw === 'true'
  return { ...(forced ? { forced } : {}), ...(aiBusy ? { aiBusy } : {}) }
}

export function readMockQuotaSwitches(): MockQuotaSwitches {
  if (typeof window === 'undefined') return {}
  return parseMockQuotaSwitches(
    window.location.search,
    { quota: import.meta.env.VITE_MOCK_QUOTA, aiBusy: import.meta.env.VITE_MOCK_AI_BUSY },
    import.meta.env.DEV,
  )
}

export interface MockQuota {
  /** The quota for the current player, given how many documents are stored. */
  snapshot(isGuest: boolean, stored: number): UploadQuota
  /** Throws the Backend's error when an upload is not allowed; counts the upload otherwise. */
  admit(isGuest: boolean, stored: number): void
  reset(): void
}

export function createMockQuota(now: () => number, switches: MockQuotaSwitches = {}): MockQuota {
  let usedToday = 0
  const limits = (isGuest: boolean) => ({
    perDay: isGuest ? MOCK_GUEST_UPLOADS_PER_DAY : MOCK_PLAYER_UPLOADS_PER_DAY,
    stored: isGuest ? MOCK_GUEST_STORED_LIMIT : MOCK_PLAYER_STORED_LIMIT,
  })
  const resetsAt = (): string => {
    const d = new Date(now())
    d.setUTCHours(24, 0, 0, 0)
    return d.toISOString()
  }
  const blocked = (isGuest: boolean, stored: number): QuotaReason | null => {
    if (switches.forced) return switches.forced
    if (switches.aiBusy) return 'ai_unavailable'
    const l = limits(isGuest)
    if (usedToday >= l.perDay) return 'player_daily_limit'
    if (stored >= l.stored) return 'stored_limit'
    return null
  }
  return {
    snapshot(isGuest, stored) {
      const l = limits(isGuest)
      const reason = blocked(isGuest, stored)
      return {
        can_upload: reason === null,
        reason,
        player: {
          is_guest: isGuest,
          used_today: switches.forced === 'player_daily_limit' ? l.perDay : usedToday,
          limit_today: l.perDay,
          stored: switches.forced === 'stored_limit' ? l.stored : stored,
          stored_limit: l.stored,
          resets_at: resetsAt(),
        },
        global: { available: reason !== 'global_daily_limit' },
        ranking: { min_chars: MOCK_RANKING_MIN_CHARS, min_topics: MOCK_RANKING_MIN_TOPICS },
      }
    },
    admit(isGuest, stored) {
      const reason = blocked(isGuest, stored)
      if (switches.aiBusy) {
        throw new ApiError(503, 'The summoning circle is busy.', 'AI_BUSY', { retry_after_seconds: 30, offer_packs: true })
      }
      switch (reason) {
        case 'player_daily_limit':
          throw new ApiError(429, 'Daily upload limit reached.', 'UPLOAD_LIMIT_PLAYER', {
            retryAfter: String(DAY_SECONDS),
            retry_after_seconds: DAY_SECONDS,
            offer_packs: true,
          })
        case 'ip_daily_limit':
          throw new ApiError(429, 'Daily upload limit reached for this network.', 'UPLOAD_LIMIT_IP', {
            retryAfter: String(DAY_SECONDS),
            retry_after_seconds: DAY_SECONDS,
            offer_packs: true,
          })
        case 'global_daily_limit':
          throw new ApiError(503, 'Uploads are paused for today.', 'UPLOADS_PAUSED_TODAY', { offer_packs: true })
        case 'ai_unavailable':
          throw new ApiError(503, 'The summoning circle is busy.', 'AI_BUSY', { retry_after_seconds: 30, offer_packs: true })
        case 'stored_limit':
          throw new ApiError(400, 'Maximum active document quota reached.', 'QUOTA_EXCEEDED', { offer_packs: true })
        default:
          usedToday += 1
      }
    },
    reset() {
      usedToday = 0
    },
  }
}
