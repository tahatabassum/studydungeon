import { z } from 'zod'
import type { PlayerStats } from '../../types/api'

/** frontend-10 (PROPOSED): `GET /stats/players`. Unknown keys are stripped. */
export const wirePlayerStatsSchema = z.object({
  players: z.number().int().nonnegative(),
  rooms_cleared_total: z.number().int().nonnegative().optional(),
  answers_total: z.number().int().nonnegative().optional(),
  packs_completed_total: z.number().int().nonnegative().optional(),
  updated_at: z.string().optional(),
  cache_seconds: z.number().nonnegative().optional(),
})

export function mapPlayerStats(w: z.output<typeof wirePlayerStatsSchema>): PlayerStats {
  const out: PlayerStats = { players: w.players }
  if (w.rooms_cleared_total !== undefined) out.rooms_cleared_total = w.rooms_cleared_total
  if (w.answers_total !== undefined) out.answers_total = w.answers_total
  if (w.packs_completed_total !== undefined) out.packs_completed_total = w.packs_completed_total
  if (w.updated_at !== undefined) out.updated_at = w.updated_at
  if (w.cache_seconds !== undefined) out.cache_seconds = w.cache_seconds
  return out
}
