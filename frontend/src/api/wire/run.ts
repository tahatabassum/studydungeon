import { z } from 'zod'
import type { ClearRoomResponse, Run, RunSummary } from '../../types/api'

/** `POST /runs` (201) and `GET /runs/{id}`: RunDetailResponse (C8, C21). */
export const wireRunRoomSchema = z.object({
  room_id: z.string().min(1),
  room_number: z.number().int(),
  topic_name: z.string(),
  monster_name: z.string(),
  monster_max_hp: z.number().int().nonnegative(),
  monster_current_hp: z.number().int().nonnegative(),
  is_cleared: z.boolean(),
  is_boss: z.boolean(),
})

export const wireRunSchema = z.object({
  id: z.string().min(1),
  dungeon_id: z.string().min(1),
  current_hp: z.number().int().nonnegative(),
  current_score: z.number().int().nonnegative(),
  current_streak: z.number().int().nonnegative(),
  xp_earned: z.number().int().nonnegative(),
  status: z.string(),
  started_at: z.string().optional(),
  rooms: z.array(wireRunRoomSchema).min(1),
})

export type WireRun = z.output<typeof wireRunSchema>

/** The room the player is in: the first one not cleared (the last room when all are). */
export function currentRunRoom(w: WireRun): WireRun['rooms'][number] {
  const sorted = [...w.rooms].sort((a, b) => a.room_number - b.room_number)
  return sorted.find((r) => !r.is_cleared) ?? sorted[sorted.length - 1]
}

/** C8: current_hp to player_hp; current room and its HP come from the rooms list. */
export function mapRun(w: WireRun): Run {
  const room = currentRunRoom(w)
  return {
    id: w.id,
    dungeon_id: w.dungeon_id,
    player_hp: w.current_hp,
    monster_hp: room.monster_current_hp,
    current_room_id: room.room_id,
    score: w.current_score,
    streak: w.current_streak,
  }
}

/** `POST /runs/{id}/rooms/{roomId}/clear` (C17). */
export const wireClearSchema = z.object({
  success: z.boolean().optional(),
  room_id: z.string().optional(),
  is_cleared: z.boolean().optional(),
  xp_delta: z.number().int().nonnegative(),
  is_boss: z.boolean().optional(),
})

export function mapClear(w: z.output<typeof wireClearSchema>): ClearRoomResponse {
  return { xp_delta: w.xp_delta, ...(w.is_boss !== undefined ? { is_boss: w.is_boss } : {}) }
}

/** `POST /runs/{id}/finish` (C15). */
export const wireFinishSchema = z.object({
  id: z.string().optional(),
  score: z.number().int().nonnegative(),
  xp_earned: z.number().int().nonnegative(),
  correct_count: z.number().int().nonnegative(),
  total_attempts: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  mastery_band: z.string(),
  status: z.string().optional(),
})

export function mapFinish(w: z.output<typeof wireFinishSchema>): RunSummary {
  return {
    score: w.score,
    xp: w.xp_earned,
    correct: w.correct_count,
    total: w.total_attempts,
    accuracy: w.accuracy,
    mastery_band: w.mastery_band,
  }
}
