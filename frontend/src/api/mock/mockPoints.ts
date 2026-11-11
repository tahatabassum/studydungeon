import type { PlayerPoints, PointsReason } from '../../types/api'

/**
 * MOCK-ONLY Leaderboard points (frontend-10 D15, PROPOSED). A simplified stand-in for V2 C.2; Person A decides
 * the real values. Table: first correct answer 100 (150 on a hard question), once per question and week;
 * a repeat of it 10; a retry half; practice modes half; room clear 50; boss clear 200; pack complete 500.
 */
export const POINTS = {
  firstCorrect: 100,
  firstCorrectHard: 150,
  repeatCorrect: 10,
  roomClear: 50,
  bossClear: 200,
  packComplete: 500,
} as const

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** 1970-01-05 was a Monday. */
const FIRST_MONDAY_MS = 4 * DAY_MS

/** Week number (Monday start, UTC) of a timestamp. */
export function weekOf(nowMs: number): number {
  return Math.floor((nowMs - FIRST_MONDAY_MS) / WEEK_MS)
}

export type PointsBoard = 'preloaded' | 'own_notes'

export interface PointsAward {
  points_awarded: number
  points_reason: PointsReason
  player_points: PlayerPoints
}

export interface AttemptPointsInput {
  attemptId: string
  questionId: string
  correct: boolean
  hard: boolean
  isRetry: boolean
  /** Weak Topics, Exam and Daily Haunt. */
  practice: boolean
  board: PointsBoard
  /** Pack that earns the points, if any. */
  packId?: string
}

export interface ClearPointsInput {
  /** Unique per clear (run and room): the same clear never pays twice. */
  clearId: string
  boss: boolean
  practice: boolean
  board: PointsBoard
  packId?: string
}

export interface MockPoints {
  attempt(input: AttemptPointsInput): PointsAward
  clear(input: ClearPointsInput): Omit<PointsAward, 'player_points'>
  /** Pack complete bonus; idempotent per pack. */
  packComplete(packId: string, board: PointsBoard): number
  totals(): PlayerPoints
  ofPack(packId: string): number
  reset(): void
}

export function createMockPoints(now: () => number): MockPoints {
  let paid = new Map<string, PointsAward>()
  let paidClears = new Map<string, Omit<PointsAward, 'player_points'>>()
  let seen = new Set<string>()
  let packsPaid = new Set<string>()
  let perPack = new Map<string, number>()
  let preloaded = 0
  let ownNotes = 0

  const totals = (): PlayerPoints => ({ preloaded, own_notes: ownNotes, overall: preloaded + ownNotes })
  const add = (board: PointsBoard, amount: number, packId?: string): void => {
    if (board === 'preloaded') preloaded += amount
    else ownNotes += amount
    if (packId !== undefined) perPack.set(packId, (perPack.get(packId) ?? 0) + amount)
  }
  const half = (n: number): number => Math.floor(n / 2)

  return {
    attempt(input) {
      const done = paid.get(input.attemptId)
      if (done) return { ...done, player_points: totals() }
      let amount = 0
      let reason: PointsReason = 'wrong'
      if (input.correct) {
        const key = `${weekOf(now())}:${input.questionId}`
        const first = !seen.has(key)
        const base = first ? (input.hard ? POINTS.firstCorrectHard : POINTS.firstCorrect) : POINTS.repeatCorrect
        reason = first ? 'first_correct' : 'repeat_correct'
        if (first && !input.practice) seen.add(key)
        if (input.practice) {
          // Practice modes pay half and never use up the weekly first-correct bonus.
          amount = half(base)
          reason = 'practice'
        } else if (input.isRetry) {
          amount = half(base)
          reason = 'retry'
        } else {
          amount = base
        }
      }
      add(input.board, amount, input.packId)
      const award: PointsAward = { points_awarded: amount, points_reason: reason, player_points: totals() }
      paid.set(input.attemptId, award)
      return { ...award }
    },

    clear(input) {
      const done = paidClears.get(input.clearId)
      if (done) return { ...done }
      const base = input.boss ? POINTS.bossClear : POINTS.roomClear
      const amount = input.practice ? half(base) : base
      const award = {
        points_awarded: amount,
        points_reason: (input.practice ? 'practice' : input.boss ? 'boss_clear' : 'room_clear') as PointsReason,
      }
      add(input.board, amount, input.packId)
      paidClears.set(input.clearId, award)
      return { ...award }
    },

    packComplete(packId, board) {
      if (packsPaid.has(packId)) return 0
      packsPaid.add(packId)
      add(board, POINTS.packComplete, packId)
      return POINTS.packComplete
    },

    totals,
    ofPack: (packId) => perPack.get(packId) ?? 0,

    reset() {
      paid = new Map()
      paidClears = new Map()
      seen = new Set()
      packsPaid = new Set()
      perPack = new Map()
      preloaded = 0
      ownNotes = 0
    },
  }
}
