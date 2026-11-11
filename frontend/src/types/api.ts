/**
 * API contract types shared by the Api_Client, Mock_Adapter and UI.
 * The backend is authoritative for all game outcomes (damage, HP, XP, streak).
 * The frontend only displays values it receives in these shapes.
 */

export interface User {
  id: string
  /** '' for a Guest whose wire username is null. Never shown publicly (use displayHandle). */
  username: string
  is_guest: boolean
  /** frontend-10: public identity fields; absent on older Backends. */
  public_id?: string
  display_name?: string
  tag?: string
  handle?: string
}

/** frontend-10 (D2): a feature switch; 'unproven' until the first call of a PROPOSED feature answers. */
export type CapabilityState = boolean | 'unproven'

export type NameReason = 'too_short' | 'too_long' | 'characters' | 'not_allowed'

/** POST /guests/name-check. */
export interface NameCheckResult {
  ok: boolean
  display_name?: string
  reason?: NameReason
  message?: string
}

/** POST /guests body. The notice acceptance is always true when sent. */
export interface CreateGuestRequest {
  display_name: string
  accept_public_notice: true
}

export interface CreateGuestResponse {
  user: User
  notice_version: string
}

/** One item of GET /dungeons. */
export interface DungeonSummary {
  id: string
  title: string
  is_public_demo: boolean
  created_at: string
  rooms_count: number
}

/** Body of register and login. The Backend normalizes the username (lowercase) and is the validator. */
export interface Credentials {
  username: string
  password: string
}

/** `GET /auth/me`: the signed-in user and when the session ends (null when it does not expire). */
export interface AuthMe {
  user: User
  expires_at: string | null
}

export interface DemoSessionResponse {
  user: User
  dungeon_id: string
  expires_at: string
}

export type QuestionType = 'mcq' | 'true_false'

/**
 * A question as shown to the player.
 * The correct answer and explanation are never part of this type.
 */
export interface Question {
  id: string
  type: QuestionType
  prompt: string
  options: string[]
  /** Real backend only: easy, medium or hard (hard questions deal 1.25x damage). */
  difficulty?: string
}

/** Plain string so the backend can add kinds without breaking the frontend. */
export type MonsterKind = string

export interface Monster {
  id: string
  name: string
  max_hp: number
  question_ids: string[]
  kind: MonsterKind
}

export interface Room {
  id: string
  label: string
  order: number
  is_boss: boolean
  monster: Monster
  /** PROPOSED (frontend-08): the Floor this room belongs to. */
  floor_id?: string
}

export type FloorStatus = 'locked' | 'ready' | 'generating' | 'failed' | 'cleared'
export type RunMode = 'floor' | 'daily_haunt' | 'weak_topics' | 'exam' | 'replay_floor'
export type FloorRank = 'S' | 'A' | 'B' | 'C'
export type MasteryBand = 'weak' | 'learning' | 'strong'

export interface TopicInfo {
  id: string
  title: string
  /** 0 to 100, from the backend (or the mock). */
  mastery: number
}

export interface FloorBoss {
  id: string
  name: string
  hp: number
  kind?: string
}

/** PROPOSED (frontend-08): a group of topics ending in a Floor_Boss. */
export interface Floor {
  id: string
  /** 1-based, contiguous. */
  index: number
  title: string
  status: FloorStatus
  topics: TopicInfo[]
  boss: FloorBoss
  rank: FloorRank | null
  room_ids: string[]
}

export interface FinalBoss {
  id: string
  name: string
  hp: number
  unlocked: boolean
}

export interface Dungeon {
  id: string
  name: string
  rooms: Room[]
  questions: Question[]
  /** Absent means a backend without floors: the mapper builds one legacy Floor (D17). */
  floors?: Floor[]
  final_boss?: FinalBoss
}

/** PROPOSED (frontend-08): body of POST /runs. */
export interface StartRunRequest {
  dungeon_id: string
  floor_id: string | null
  mode: RunMode
}

export interface Run {
  id: string
  dungeon_id: string
  player_hp: number
  monster_hp: number
  current_room_id: string
  /** Real backend only (resume data): the run's score and streak so far. */
  score?: number
  streak?: number
  /** PROPOSED (frontend-08) */
  mode?: RunMode
  /** PROPOSED (frontend-08): seed of the question draw; display and tests only. */
  run_seed?: string
  /** PROPOSED (frontend-08): Daily Haunt items for a daily_haunt run. */
  revenants?: DueReview[]
  /** PROPOSED (frontend-08): the rooms a weak_topics or exam run covers, in play order. */
  room_ids?: string[]
}

/** Request body for an attempt. Carries no correctness or damage fields. */
export interface AttemptRequest {
  question_id: string
  selected_answer: string
  attempt_id: string
  /** Weapon to strike with. The real backend validates it; absent means the Rusty Dagger. */
  weapon_id?: WeaponId
}

/** Authoritative result of an attempt, determined by the backend. */
export interface AnswerResult {
  correct: boolean
  damage_dealt: number
  monster_hp_remaining: number
  player_hp_remaining: number
  score_delta: number
  /** Absent in real mode: the attempt response carries no XP. HUD XP comes from clear and finish. */
  xp_delta?: number
  streak: number
  /** Absent in real mode; the Source line then falls back to evidence_quote. */
  source?: { page: number; chunk_id: string }
  review_status?: 'due' | 'not_due'
  /** Real backend: the quote from the player's notes that grounds the answer. */
  evidence_quote?: string
  /** Optional; when absent the Source_Line shows only the page. */
  explanation?: string
  /** PROPOSED (pending Person A): weapon used for the strike. Absent means Rusty Dagger. */
  weapon_id?: string
  /** PROPOSED (pending Person A): presentation-only critical flag; damage is unchanged. */
  is_critical?: boolean
  /** PROPOSED (frontend-08): the question returns after this many further questions; null or absent means never. */
  requeue_after?: number | null
  /** PROPOSED (frontend-08): this answer was a second chance. */
  is_retry?: boolean
  /** PROPOSED (frontend-08): multiplier already applied to damage and XP on a retry. */
  retry_multiplier?: number
  /** PROPOSED (frontend-08): combo counter, display only. */
  combo?: number
  /** PROPOSED (frontend-08): revealed only after a wrong answer. */
  correct_answer?: string
  /** PROPOSED (frontend-10): Leaderboard points for this answer. */
  points_awarded?: number
  points_reason?: string
  points_bonus?: number
  player_points?: PlayerPoints
}

export interface ClearRoomResponse {
  xp_delta: number
  is_boss?: boolean
  /** PROPOSED (frontend-10): Leaderboard points for this clear. */
  points_awarded?: number
  points_reason?: string
}

export interface RunSummary {
  /** PROPOSED (frontend-10): Leaderboard points earned in this run, the player's totals and the pack outcome. */
  points_earned?: number
  player_points?: PlayerPoints
  pack_progress?: PackProgress
  score: number
  xp: number
  correct: number
  total: number
  /** Ratio from 0 to 1. */
  accuracy: number
  /** Real backend: one band for the whole run (Weak, Learning or Strong). */
  mastery_band?: string
  /** PROPOSED (pending Person A): badges earned this run. */
  badges_earned?: BadgeId[]
  /** PROPOSED (pending Person A): rank on the dungeon leaderboard after this run. */
  leaderboard_rank?: number
  /** PROPOSED (pending Person A): weapon unlocked by this run, if any. */
  weapon_unlocked?: WeaponId | null
  /** PROPOSED (pending Person A): level change caused by this run, if any. */
  level_up?: { from: number; to: number } | null
  /** PROPOSED (pending Person A): per-topic mastery for the Scorecard. */
  topic_mastery?: { room_id: string; label: string; percent: number }[]
  /** PROPOSED (pending Person A): concepts answered wrongly, with source page. */
  weak_concepts?: { text: string; page: number }[]
  /** PROPOSED (frontend-08) */
  floor_rank?: FloorRank
  /** PROPOSED (frontend-08) */
  mastery_by_topic?: { topic_id: string; title: string; mastery: number }[]
  /** PROPOSED (frontend-08) */
  chest_rewards?: ChestReward[]
}

export interface ChestReward {
  id: string
  kind: 'xp' | 'coins' | 'weapon' | 'badge'
  label: string
  amount?: number
}

export interface ProgressInfo {
  level: number
  total_xp: number
  /** Absent in real mode: the HUD then shows total XP only. */
  xp_to_next?: number
  /** Real mode: ids of the weapons the backend reports as unlocked. */
  unlocked_weapons?: WeaponId[]
  /** PROPOSED (pending Person A) */
  badges?: BadgeId[]
  /** PROPOSED (pending Person A) */
  weapons?: { id: WeaponId; unlock_level: number; requirement?: string }[]
  /** PROPOSED (pending Person A) */
  recent_runs?: { id: string; dungeon_name: string; score: number; accuracy: number; finished_at: string }[]
  /** PROPOSED (pending Person A) */
  due_review_count?: number
  /** PROPOSED (frontend-08) */
  notes_conquered_percent?: number
  /** PROPOSED (frontend-08) */
  memory_strength?: { topic_id: string; title: string; strength: number }[]
  /** PROPOSED (frontend-08) */
  streak_calendar?: { date: string; reviewed: boolean }[]
  /** PROPOSED (frontend-08) */
  weak_concepts?: { text: string; page: number | null; source_ref?: string }[]
  /** PROPOSED (frontend-08) */
  equipped_weapon?: WeaponId
}

/**
 * PROPOSED (pending Person A): a question the player got wrong and should review.
 * It becomes a Revenant in the room it came from. The question never carries the answer.
 */
export interface DueReview {
  id: string
  question: Question
  room_id: string
  times_missed?: number
}

/** PROPOSED (frontend-08): GET /reviews/due, new shape. */
export interface DueReviewsResponse {
  due_count: number
  next_due_at: string | null
  daily_streak: number
  items: DueReview[]
}

/** PROPOSED (frontend-08): per-floor generation status. */
export interface GenerationStatus {
  dungeon_id: string
  floors: { id: string; status: FloorStatus }[]
}

/** Real document pipeline (frontend-08 C29): `GET /documents/{id}/status` values. */
export type DocumentStatusValue = 'processing' | 'accepted' | 'rejected' | 'failed'

/** `POST /documents` (202): the document was accepted for processing. */
export interface DocumentUpload {
  id: string
  status: DocumentStatusValue
  message: string
}

/** `GET /documents/{id}/status`. `chunks_count` is 0 until the document is accepted. */
export interface DocumentStatus {
  id: string
  status: DocumentStatusValue
  rejection_reason: string | null
  chunks_count: number
  relevance_score: number | null
  readability_score: number | null
}

/** `GET /documents/{id}/topics`: one detected topic. */
export interface DocumentTopic {
  id: string
  name: string
  description: string
  order_index: number
}

/** PROPOSED (pending Person A): one row of the leaderboard. `rank` is 1-based; `id` is the last tie-break. */
export interface LeaderboardEntry {
  id: string
  rank: number
  display_name: string
  is_guest: boolean
  is_seeded_rival: boolean
  level: number
  score: number
  /** Ratio from 0 to 1. */
  accuracy: number
  best_streak: number
  badge_ids: BadgeId[]
}

export type LeaderboardPeriod = 'all' | 'week'

/** PROPOSED (pending Person A): GET /leaderboard?dungeon_id=&period=&limit= */
export interface LeaderboardQuery {
  dungeonId: string
  period: LeaderboardPeriod
  limit?: number
}

/** PROPOSED (pending Person A): GET /leaderboard. `me.rank` and `me.entry` are null without a stored run. */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  me: { rank: number | null; is_provisional: boolean; entry: LeaderboardEntry | null }
  updated_at: string
}

/** PROPOSED (pending Person A) */
export type WeaponId =
  | 'rusty_dagger'
  | 'arcane_staff'
  | 'hunter_crossbow'
  | 'spectral_hammer'
  | 'flame_sigil'

/** PROPOSED (pending Person A) */
export type BadgeId =
  | 'perfect_room'
  | 'no_damage'
  | 'streak_5'
  | 'boss_slayer'
  | 'first_blood'
  | 'memory_keeper'
  | 'speed_reader'
  | 'dungeon_master'

/** frontend-10 (V2 B.2, PROPOSED): preloaded packs and Leaderboard points. */
export type PackStatus = 'locked' | 'available' | 'in_progress' | 'completed'
export interface Pack {
  id: string
  order: number
  title: string
  description: string
  dungeon_id: string
  floors_total: number
  floors_cleared: number
  final_boss_cleared: boolean
  status: PackStatus
  points_earned: number
  /** Mock only: placeholder content. */
  sample?: boolean
}
export interface PacksResponse {
  packs: Pack[]
  next_pack_id: string | null
  all_completed: boolean
}
export interface PackProgress {
  pack_id: string
  status: PackStatus
  unlocked_pack_id: string | null
  all_completed: boolean
}
export type PointsReason =
  | 'first_correct'
  | 'repeat_correct'
  | 'retry'
  | 'wrong'
  | 'too_fast'
  | 'practice'
  | 'not_ranked'
  | 'daily_cap'
  | 'room_clear'
  | 'boss_clear'
  | 'pack_complete'
export interface PlayerPoints {
  preloaded: number
  own_notes: number
  overall: number
}
