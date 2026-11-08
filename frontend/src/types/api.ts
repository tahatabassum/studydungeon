/**
 * API contract types shared by the Api_Client, Mock_Adapter and UI.
 * The backend is authoritative for all game outcomes (damage, HP, XP, streak).
 * The frontend only displays values it receives in these shapes.
 */

export interface User {
  id: string
  username: string
  is_guest: boolean
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
}

export interface Dungeon {
  id: string
  name: string
  rooms: Room[]
  questions: Question[]
}

export interface Run {
  id: string
  dungeon_id: string
  player_hp: number
  monster_hp: number
  current_room_id: string
}

/** Request body for an attempt. Carries no correctness or damage fields. */
export interface AttemptRequest {
  question_id: string
  selected_answer: string
  attempt_id: string
}

/** Authoritative result of an attempt, determined by the backend. */
export interface AnswerResult {
  correct: boolean
  damage_dealt: number
  monster_hp_remaining: number
  player_hp_remaining: number
  score_delta: number
  xp_delta: number
  streak: number
  source: { page: number; chunk_id: string }
  review_status: 'due' | 'not_due'
  /** Optional; when absent the Source_Line shows only the page. */
  explanation?: string
  /** PROPOSED (pending Person A): weapon used for the strike. Absent means Rusty Dagger. */
  weapon_id?: string
  /** PROPOSED (pending Person A): presentation-only critical flag; damage is unchanged. */
  is_critical?: boolean
}

export interface ClearRoomResponse {
  xp_delta: number
}

export interface RunSummary {
  score: number
  xp: number
  correct: number
  total: number
  /** Ratio from 0 to 1. */
  accuracy: number
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
}

export interface ProgressInfo {
  level: number
  total_xp: number
  xp_to_next: number
  /** PROPOSED (pending Person A) */
  badges?: BadgeId[]
  /** PROPOSED (pending Person A) */
  weapons?: { id: WeaponId; unlock_level: number }[]
  /** PROPOSED (pending Person A) */
  recent_runs?: { id: string; dungeon_name: string; score: number; accuracy: number; finished_at: string }[]
  /** PROPOSED (pending Person A) */
  due_review_count?: number
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
