import type { QuotaReason, UploadQuota } from '../types/api'

export interface QuotaView {
  /** True only when the upload may go ahead. The Backend quota wins; this only displays it. */
  allowed: boolean
  /** Uploads left today, never negative. */
  remaining: number
  /** Set when blocked. */
  reason: QuotaReason | null
  /** A one-line status for the panel. */
  line: string
  /** Blocked: offer the preloaded dungeons instead. */
  offerPacks: boolean
  /** Blocked guest at a personal limit: offer to create an account. */
  offerAccount: boolean
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Pure view of the quota. Property 16: a blocked quota never offers an upload. */
export function quotaView(quota: UploadQuota): QuotaView {
  const { player } = quota
  const remaining = Math.max(0, player.limit_today - player.used_today)
  const dailyFull = remaining === 0
  const storedFull = player.stored >= player.stored_limit
  const globalDown = quota.global?.available === false

  let reason: QuotaReason | null = null
  if (!quota.can_upload) reason = quota.reason ?? (storedFull ? 'stored_limit' : dailyFull ? 'player_daily_limit' : globalDown ? 'global_daily_limit' : 'ai_unavailable')
  else if (quota.reason) reason = quota.reason
  else if (dailyFull) reason = 'player_daily_limit'
  else if (storedFull) reason = 'stored_limit'
  else if (globalDown) reason = 'global_daily_limit'

  if (reason === null) {
    return {
      allowed: true,
      remaining,
      reason: null,
      line: `${plural(remaining, 'upload', 'uploads')} left today (${player.used_today} of ${player.limit_today} used).`,
      offerPacks: false,
      offerAccount: false,
    }
  }
  const lines: Record<QuotaReason, string> = {
    player_daily_limit: `You have used your ${plural(player.limit_today, 'upload', 'uploads')} for today. Come back tomorrow.`,
    ip_daily_limit: 'Too many uploads came from your network today. Try again tomorrow.',
    stored_limit: `You already keep ${player.stored} of ${plural(player.stored_limit, 'document', 'documents')}. Remove one to upload another.`,
    global_daily_limit: 'Uploads are paused for today. Come back tomorrow.',
    ai_unavailable: 'The summoning circle is busy right now. Try again in a moment.',
  }
  return {
    allowed: false,
    remaining,
    reason,
    line: lines[reason],
    offerPacks: true,
    offerAccount: player.is_guest && (reason === 'player_daily_limit' || reason === 'stored_limit'),
  }
}
