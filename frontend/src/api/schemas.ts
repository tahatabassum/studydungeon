import { z } from 'zod'
import type {
  AnswerResult,
  AuthMe,
  ClearRoomResponse,
  DemoSessionResponse,
  DocumentStatus,
  DocumentTopic,
  DocumentUpload,
  DueReview,
  DueReviewsResponse,
  Dungeon,
  GenerationStatus,
  LeaderboardResponse,
  ProgressInfo,
  Run,
  RunSummary,
  StartRunRequest,
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

/** `GET /auth/me`: the user and the session expiry (C22). */
export const authMeSchema: z.ZodType<AuthMe> = z.object({
  user: userSchema,
  expires_at: z.string().nullable(),
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
  difficulty: z.string().optional(),
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
  floor_id: z.string().optional(),
})

export const floorStatusSchema = z.enum(['locked', 'ready', 'generating', 'failed', 'cleared'])
export const floorRankSchema = z.enum(['S', 'A', 'B', 'C'])
export const runModeSchema = z.enum(['floor', 'daily_haunt', 'weak_topics', 'exam', 'replay_floor'])

export const topicInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  mastery: z.number().min(0).max(100),
})

export const floorSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1),
  title: z.string(),
  status: floorStatusSchema,
  topics: z.array(topicInfoSchema),
  boss: z.object({ id: z.string(), name: z.string(), hp: z.number(), kind: z.string().optional() }),
  rank: floorRankSchema.nullable(),
  room_ids: z.array(z.string()),
})

export const finalBossSchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
  unlocked: z.boolean(),
})

export const dungeonSchema: z.ZodType<Dungeon> = z.object({
  id: z.string(),
  name: z.string(),
  rooms: z.array(roomSchema),
  questions: z.array(questionSchema),
  floors: z.array(floorSchema).optional(),
  final_boss: finalBossSchema.optional(),
})

export const startRunRequestSchema: z.ZodType<StartRunRequest> = z.object({
  dungeon_id: z.string(),
  floor_id: z.string().nullable(),
  mode: runModeSchema,
})

const dueReviewSchema = z.object({
  id: z.string(),
  question: questionSchema,
  room_id: z.string(),
  times_missed: z.number().optional(),
})

export const runSchema: z.ZodType<Run> = z.object({
  id: z.string(),
  dungeon_id: z.string(),
  player_hp: z.number(),
  monster_hp: z.number(),
  current_room_id: z.string(),
  score: z.number().optional(),
  streak: z.number().optional(),
  // PROPOSED (frontend-08)
  mode: runModeSchema.optional(),
  run_seed: z.string().optional(),
  revenants: z.array(dueReviewSchema).optional(),
  room_ids: z.array(z.string()).optional(),
})

export const answerResultSchema: z.ZodType<AnswerResult> = z.object({
  correct: z.boolean(),
  damage_dealt: z.number(),
  monster_hp_remaining: z.number(),
  player_hp_remaining: z.number(),
  score_delta: z.number(),
  xp_delta: z.number().optional(),
  streak: z.number(),
  source: z.object({ page: z.number(), chunk_id: z.string() }).optional(),
  review_status: z.enum(['due', 'not_due']).optional(),
  evidence_quote: z.string().optional(),
  explanation: z.string().optional(),
  // PROPOSED
  weapon_id: z.string().optional(),
  is_critical: z.boolean().optional(),
  requeue_after: z.number().int().nonnegative().nullable().optional(),
  is_retry: z.boolean().optional(),
  retry_multiplier: z.number().optional(),
  combo: z.number().optional(),
  correct_answer: z.string().optional(),
})

export const clearRoomSchema: z.ZodType<ClearRoomResponse> = z.object({
  xp_delta: z.number(),
  is_boss: z.boolean().optional(),
})

export const chestRewardSchema = z.object({
  id: z.string(),
  kind: z.enum(['xp', 'coins', 'weapon', 'badge']),
  label: z.string(),
  amount: z.number().optional(),
})

export const runSummarySchema: z.ZodType<RunSummary> = z.object({
  score: z.number(),
  xp: z.number(),
  correct: z.number(),
  total: z.number(),
  accuracy: z.number(),
  mastery_band: z.string().optional(),
  // PROPOSED
  badges_earned: z.array(badgeId).optional(),
  leaderboard_rank: z.number().optional(),
  weapon_unlocked: weaponId.nullable().optional(),
  level_up: z.object({ from: z.number(), to: z.number() }).nullable().optional(),
  topic_mastery: z.array(z.object({ room_id: z.string(), label: z.string(), percent: z.number() })).optional(),
  weak_concepts: z.array(z.object({ text: z.string(), page: z.number() })).optional(),
  floor_rank: floorRankSchema.optional(),
  mastery_by_topic: z
    .array(z.object({ topic_id: z.string(), title: z.string(), mastery: z.number() }))
    .optional(),
  chest_rewards: z.array(chestRewardSchema).optional(),
})

export const progressSchema: z.ZodType<ProgressInfo> = z.object({
  level: z.number(),
  total_xp: z.number(),
  xp_to_next: z.number().optional(),
  unlocked_weapons: z.array(weaponId).optional(),
  // PROPOSED
  badges: z.array(badgeId).optional(),
  weapons: z
    .array(z.object({ id: weaponId, unlock_level: z.number(), requirement: z.string().optional() }))
    .optional(),
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
  notes_conquered_percent: z.number().optional(),
  memory_strength: z
    .array(z.object({ topic_id: z.string(), title: z.string(), strength: z.number() }))
    .optional(),
  streak_calendar: z.array(z.object({ date: z.string(), reviewed: z.boolean() })).optional(),
  weak_concepts: z
    .array(z.object({ text: z.string(), page: z.number().nullable(), source_ref: z.string().optional() }))
    .optional(),
  equipped_weapon: weaponId.optional(),
})

/** PROPOSED: a bare array of due reviews (the legacy shape, still returned by the old adapter). */
export const dueReviewsSchema: z.ZodType<DueReview[]> = z.array(dueReviewSchema)

/** PROPOSED (frontend-08): GET /reviews/due, new shape. */
export const dueReviewsResponseSchema: z.ZodType<DueReviewsResponse> = z.object({
  due_count: z.number().int().nonnegative(),
  next_due_at: z.string().nullable(),
  daily_streak: z.number().int().nonnegative(),
  items: z.array(dueReviewSchema),
})

/** PROPOSED (frontend-08): per-floor generation status. */
export const generationStatusSchema: z.ZodType<GenerationStatus> = z.object({
  dungeon_id: z.string(),
  floors: z.array(z.object({ id: z.string(), status: floorStatusSchema })),
})

const documentStatusValue = z.enum(['processing', 'accepted', 'rejected', 'failed'])

export const documentUploadSchema: z.ZodType<DocumentUpload> = z.object({
  id: z.string(),
  status: documentStatusValue,
  message: z.string(),
})

export const documentStatusSchema: z.ZodType<DocumentStatus> = z.object({
  id: z.string(),
  status: documentStatusValue,
  rejection_reason: z.string().nullable(),
  chunks_count: z.number().int().nonnegative(),
  relevance_score: z.number().nullable(),
  readability_score: z.number().nullable(),
})

export const documentTopicsSchema: z.ZodType<DocumentTopic[]> = z.array(
  z.object({ id: z.string(), name: z.string(), description: z.string(), order_index: z.number().int() }),
)

export const leaderboardEntrySchema = z.object({
  id: z.string(),
  rank: z.number().int().min(0),
  display_name: z.string(),
  is_guest: z.boolean(),
  is_seeded_rival: z.boolean(),
  level: z.number(),
  score: z.number(),
  accuracy: z.number().min(0).max(1),
  best_streak: z.number(),
  badge_ids: z.array(badgeId),
})

/** PROPOSED (pending Person A): GET /leaderboard. */
export const leaderboardResponseSchema: z.ZodType<LeaderboardResponse> = z.object({
  entries: z.array(leaderboardEntrySchema),
  me: z.object({
    rank: z.number().int().min(1).nullable(),
    is_provisional: z.boolean(),
    entry: leaderboardEntrySchema.nullable(),
  }),
  updated_at: z.string(),
})

/** One entry per existing endpoint; the HTTP client and the fixture test both use this table. */
export const ENDPOINT_SCHEMAS = {
  startDemoSession: { endpoint: 'POST /demo/session', schema: demoSessionSchema },
  register: { endpoint: 'POST /auth/register', schema: userSchema },
  login: { endpoint: 'POST /auth/login', schema: userSchema },
  getMe: { endpoint: 'GET /auth/me', schema: authMeSchema },
  getDungeon: { endpoint: 'GET /dungeons/{id}', schema: dungeonSchema },
  startRun: { endpoint: 'POST /runs', schema: runSchema },
  getRun: { endpoint: 'GET /runs/{id}', schema: runSchema },
  submitAttempt: { endpoint: 'POST /runs/{id}/attempts', schema: answerResultSchema },
  clearRoom: { endpoint: 'POST /runs/{id}/rooms/{roomId}/clear', schema: clearRoomSchema },
  finishRun: { endpoint: 'POST /runs/{id}/finish', schema: runSummarySchema },
  getProgress: { endpoint: 'GET /progress', schema: progressSchema },
  getDueReviews: { endpoint: 'GET /reviews/due', schema: dueReviewsSchema },
  getDueSummary: { endpoint: 'GET /reviews/due (summary)', schema: dueReviewsResponseSchema },
  getGenerationStatus: { endpoint: 'GET /dungeons/{id}/generation-status', schema: generationStatusSchema },
  getLeaderboard: { endpoint: 'GET /leaderboard', schema: leaderboardResponseSchema },
  uploadDocument: { endpoint: 'POST /documents', schema: documentUploadSchema },
  getDocumentStatus: { endpoint: 'GET /documents/{id}/status', schema: documentStatusSchema },
  getDocumentTopics: { endpoint: 'GET /documents/{id}/topics', schema: documentTopicsSchema },
  generateDungeon: { endpoint: 'POST /documents/{id}/generate-dungeon', schema: dungeonSchema },
  retryDocument: { endpoint: 'POST /documents/{id}/retry', schema: documentUploadSchema },
} as const
