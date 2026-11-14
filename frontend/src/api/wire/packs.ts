import { z } from 'zod'
import type { Pack, PackProgress, PacksResponse, PlayerPoints } from '../../types/api'

/** frontend-10 (PROPOSED, V2 B.2): `GET /packs` and the points fields on attempt, clear and finish. */
export const wirePackStatusSchema = z.enum(['locked', 'available', 'in_progress', 'completed'])

export const wirePlayerPointsSchema = z.object({
  preloaded: z.number().int().nonnegative(),
  own_notes: z.number().int().nonnegative(),
  overall: z.number().int().nonnegative(),
})

export const wirePackProgressSchema = z.object({
  pack_id: z.string().min(1),
  status: wirePackStatusSchema,
  unlocked_pack_id: z.string().nullable(),
  all_completed: z.boolean(),
})

export const wirePackSchema = z.object({
  id: z.string().min(1),
  order: z.number().int(),
  title: z.string(),
  description: z.string(),
  dungeon_id: z.string().min(1),
  floors_total: z.number().int().nonnegative(),
  floors_cleared: z.number().int().nonnegative(),
  final_boss_cleared: z.boolean(),
  status: wirePackStatusSchema,
  points_earned: z.number().int().nonnegative(),
})

export const wirePacksSchema = z.object({
  packs: z.array(wirePackSchema),
  next_pack_id: z.string().nullable(),
  all_completed: z.boolean(),
})

/** Optional points fields shared by attempt, clear and finish responses. */
export const wirePointsFields = {
  points_awarded: z.number().int().nonnegative().optional(),
  points_reason: z.string().optional(),
}

export function mapPlayerPoints(w: z.output<typeof wirePlayerPointsSchema>): PlayerPoints {
  return { preloaded: w.preloaded, own_notes: w.own_notes, overall: w.overall }
}

export function mapPackProgress(w: z.output<typeof wirePackProgressSchema>): PackProgress {
  return { pack_id: w.pack_id, status: w.status, unlocked_pack_id: w.unlocked_pack_id, all_completed: w.all_completed }
}

export function mapPacks(w: z.output<typeof wirePacksSchema>): PacksResponse {
  const packs: Pack[] = w.packs.map((p) => ({
    id: p.id,
    order: p.order,
    title: p.title,
    description: p.description,
    dungeon_id: p.dungeon_id,
    floors_total: p.floors_total,
    floors_cleared: p.floors_cleared,
    final_boss_cleared: p.final_boss_cleared,
    status: p.status,
    points_earned: p.points_earned,
  }))
  return { packs, next_pack_id: w.next_pack_id, all_completed: w.all_completed }
}
