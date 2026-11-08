import { z } from 'zod'
import type {
  AnswerResult,
  ClearRoomResponse,
  DemoSessionResponse,
  DueReview,
  Dungeon,
  ProgressInfo,
  Run,
  RunSummary,
} from '../types/api'

/**
 * zod schemas for every response of the Api_Client. They mirror src/types/api.ts.
 * Fields tagged PROPOSED in the types are `.optional()` here so a backend that has not
 * added them yet still validates. Unknown extra keys are stripped, not rejected.
 */

const weaponId = z.enum(['rusty_dagger', 'arcane_staff', 'hunter_crossbow', 'spectral_hammer', 'flame_sigil'])
const badgeId = z.enum([
  'perfect_room',
  'no_damage',
  'streak_5',
  'boss_slayer',
  'first_blood',
  'memory_keeper',
  'speed_reader',
  'dungeon_master',
])

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  is_guest: z.boolean(),
})

export const demoSessionSchema: z.ZodType<DemoSessionResponse> = z.object({
  user: userSchema,
  dungeon_id: z.string(),
  expires_at: z.string(),
})

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'true_false']),
  prompt: z.string(),
  options: z.array(z.string()),
})

export const monsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  max_hp: z.number(),
  question_ids: z.array(z.string()),
  kind: z.string(),
})

export const roomSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  is_boss: z.boolean(),
  monster: monsterSchema,
})

export const dungeonSchema: z.ZodType<Dungeon> = z.object({
  id: z.string(),
  name: z.string(),
  rooms: z.array(roomSchema),
  questions: z.array(questionSchema),
})

export const runSchema: z.ZodType<Run> = z.object({
  id: z.string(),
  dungeon_id: z.string(),
  player_hp: z.number(),
  monster_hp: z.number(),
  current_room_id: z.string(),
})

export const answerResultSchema: z.ZodType<AnswerResult> = z.object({
  correct: z.boolean(),
  damage_dealt: z.number(),
  monster_hp_remaining: z.number(),
  player_hp_remaining: z.number(),
  score_delta: z.number(),
  xp_delta: z.number(),
  streak: z.number(),
  source: z.object({ page: z.number(), chunk_id: z.string() }),
  review_status: z.enum(['due', 'not_due']),
  explanation: z.string().optional(),
  // PROPOSED
  weapon_id: z.string().optional(),
  is_critical: z.boolean().optional(),
})

export const clearRoomSchema: z.ZodType<ClearRoomResponse> = z.object({
  xp_delta: z.number(),
})

export const runSummarySchema: z.ZodType<RunSummary> = z.object({
  score: z.number(),
  xp: z.number(),
  correct: z.number(),
  total: z.number(),
  accuracy: z.number(),
  // PROPOSED
  badges_earned: z.array(badgeId).optional(),
  leaderboard_rank: z.number().optional(),
  weapon_unlocked: weaponId.nullable().optional(),
  level_up: z.object({ from: z.number(), to: z.number() }).nullable().optional(),
  topic_mastery: z.array(z.object({ room_id: z.string(), label: z.string(), percent: z.number() })).optional(),
  weak_concepts: z.array(z.object({ text: z.string(), page: z.number() })).optional(),
})

export const progressSchema: z.ZodType<ProgressInfo> = z.object({
  level: z.number(),
  total_xp: z.number(),
  xp_to_next: z.number(),
  // PROPOSED
  badges: z.array(badgeId).optional(),
  weapons: z.array(z.object({ id: weaponId, unlock_level: z.number() })).optional(),
  recent_runs: z
    .array(
      z.object({
        id: z.string(),
        dungeon_name: z.string(),
        score: z.number(),
        accuracy: z.number(),
        finished_at: z.string(),
      }),
    )
    .optional(),
  due_review_count: z.number().optional(),
})

/** PROPOSED: GET /reviews/due returns a bare array of due reviews. */
export const dueReviewsSchema: z.ZodType<DueReview[]> = z.array(
  z.object({
    id: z.string(),
    question: questionSchema,
    room_id: z.string(),
    times_missed: z.number().optional(),
  }),
)

/** One entry per existing endpoint; the HTTP client and the fixture test both use this table. */
export const ENDPOINT_SCHEMAS = {
  startDemoSession: { endpoint: 'POST /demo/session', schema: demoSessionSchema },
  getDungeon: { endpoint: 'GET /dungeons/{id}', schema: dungeonSchema },
  startRun: { endpoint: 'POST /runs', schema: runSchema },
  submitAttempt: { endpoint: 'POST /runs/{id}/attempts', schema: answerResultSchema },
  clearRoom: { endpoint: 'POST /runs/{id}/rooms/{roomId}/clear', schema: clearRoomSchema },
  finishRun: { endpoint: 'POST /runs/{id}/finish', schema: runSummarySchema },
  getProgress: { endpoint: 'GET /progress', schema: progressSchema },
  getDueReviews: { endpoint: 'GET /reviews/due', schema: dueReviewsSchema },
} as const
