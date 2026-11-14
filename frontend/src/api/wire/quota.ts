import { z } from 'zod'
import type { UploadQuota } from '../../types/api'

/** frontend-10 (PROPOSED, V2 G): `GET /uploads/quota`. Unknown keys are stripped. */
export const wireUploadQuotaSchema = z.object({
  can_upload: z.boolean(),
  reason: z.enum(['player_daily_limit', 'ip_daily_limit', 'stored_limit', 'global_daily_limit', 'ai_unavailable']).nullish(),
  player: z.object({
    is_guest: z.boolean(),
    used_today: z.number().int().nonnegative(),
    limit_today: z.number().int().nonnegative(),
    stored: z.number().int().nonnegative(),
    stored_limit: z.number().int().nonnegative(),
    resets_at: z.string().optional(),
  }),
  global: z.object({ available: z.boolean() }).optional(),
  ranking: z.object({ min_chars: z.number().int().nonnegative(), min_topics: z.number().int().nonnegative() }).optional(),
})

export function mapUploadQuota(w: z.output<typeof wireUploadQuotaSchema>): UploadQuota {
  const out: UploadQuota = {
    can_upload: w.can_upload,
    reason: w.reason ?? null,
    player: {
      is_guest: w.player.is_guest,
      used_today: w.player.used_today,
      limit_today: w.player.limit_today,
      stored: w.player.stored,
      stored_limit: w.player.stored_limit,
      ...(w.player.resets_at !== undefined ? { resets_at: w.player.resets_at } : {}),
    },
  }
  if (w.global) out.global = { available: w.global.available }
  if (w.ranking) out.ranking = { min_chars: w.ranking.min_chars, min_topics: w.ranking.min_topics }
  return out
}
