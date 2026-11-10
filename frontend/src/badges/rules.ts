import type { BadgeId } from '../types/api'

/**
 * Badge rules (frontend-07 Phase 7, D19). Pure and shared by the Mock_Adapter and the Offline_Module ONLY
 * (a boundary test enforces it). In real mode the badges come from the Backend's `badges_earned` and are shown
 * as received, so no screen or hook imports this file.
 */

/** What happened in one room of the run. */
export interface RoomRecord {
  correct: number
  wrong: number
  /** HP the player lost in this room. */
  damageTaken: number
  cleared: boolean
}

/** Everything the rules read about a finished run. */
export interface RunStats {
  rooms: readonly RoomRecord[]
  /** Correct and wrong answers in the whole run, Revenants included. */
  correct: number
  wrong: number
  /** HP lost in the whole run. */
  damageTaken: number
  /** A boss (Floor_Boss, Final_Boss or the dungeon boss) was cleared in this run. */
  bossCleared: boolean
  /** Best streak of correct answers. */
  maxStreak: number
  /** Revenants (haunted memories) laid to rest in this run, Daily Haunt rests included. */
  revenantsCleared: number
  /**
   * Floors model: every Floor and the Final_Boss are cleared across the campaign (this run included).
   * A single Floor run never sets it unless it was the last piece.
   */
  allRoomsCleared: boolean
  /** Fast reads. The attempt contract carries no timing, so the mocks pass 0 (D19). */
  fastReads?: number
}

export interface BadgeOptions {
  /** D19: `VITE_BADGE_SPEED_READER`. Off by default. */
  speedReader?: boolean
}

/** Revenants to lay to rest for Memory Keeper. */
export const MEMORY_KEEPER_REVENANTS = 3
/** Best streak for On Fire. */
export const STREAK_BADGE_AT = 5
/** Fast reads for Speed Reader (when enabled). */
export const SPEED_READER_FAST_READS = 3

/**
 * The badges a run earns, in catalog order, without duplicates.
 *
 * - perfect_room: a cleared room with at least one correct answer and no wrong one.
 * - no_damage: at least one correct answer, no wrong answer and no HP lost in the whole run.
 * - streak_5: best streak of 5 or more.
 * - boss_slayer: a boss was cleared in this run.
 * - first_blood: at least one correct answer.
 * - memory_keeper: 3 or more Revenants laid to rest in the run (Daily Haunt rests count).
 * - speed_reader: only when enabled by the flag, with 3 or more fast reads.
 * - dungeon_master (floors model): every Floor and the Final_Boss are cleared, and THIS run (the last one that
 *   completed the set) was clean: boss_slayer and no_damage are both earned.
 */
export function evaluateBadges(stats: RunStats, options: BadgeOptions = {}): BadgeId[] {
  const earned = new Set<BadgeId>()
  if (stats.correct >= 1) earned.add('first_blood')
  if (stats.rooms.some((r) => r.cleared && r.wrong === 0 && r.correct >= 1)) earned.add('perfect_room')
  if (stats.correct >= 1 && stats.wrong === 0 && stats.damageTaken === 0) earned.add('no_damage')
  if (stats.maxStreak >= STREAK_BADGE_AT) earned.add('streak_5')
  if (stats.bossCleared) earned.add('boss_slayer')
  if (stats.revenantsCleared >= MEMORY_KEEPER_REVENANTS) earned.add('memory_keeper')
  if (options.speedReader === true && (stats.fastReads ?? 0) >= SPEED_READER_FAST_READS) earned.add('speed_reader')
  if (stats.allRoomsCleared && earned.has('boss_slayer') && earned.has('no_damage')) earned.add('dungeon_master')
  return ORDER.filter((id) => earned.has(id))
}

const ORDER: readonly BadgeId[] = [
  'first_blood',
  'streak_5',
  'perfect_room',
  'no_damage',
  'boss_slayer',
  'memory_keeper',
  'speed_reader',
  'dungeon_master',
]

/** Union of badge lists, in catalog order (the Dashboard grid and the player's row). */
export function mergeBadges(lists: readonly (readonly BadgeId[] | undefined)[]): BadgeId[] {
  const all = new Set<BadgeId>()
  for (const list of lists) for (const id of list ?? []) all.add(id)
  return ORDER.filter((id) => all.has(id))
}
