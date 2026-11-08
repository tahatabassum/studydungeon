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
}

export interface ProgressInfo {
  level: number
  total_xp: number
  xp_to_next: number
}
