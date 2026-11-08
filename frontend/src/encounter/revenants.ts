import type { RevenantSpawn } from '@/game/events'
import type { DueReview } from '@/types/api'

/** At most this many Revenants haunt one room. */
export const MAX_REVENANTS_PER_ROOM = 3

/** Spoken by the Revenant before its question. */
export const REVENANT_INTRO = 'The ghost of a question you forgot...'

/** Portrait/monster kind used for Revenants. */
export const REVENANT_KIND = 'revenant'

/** How many Revenants to show for a list of due reviews: the smaller of 3 and the list length. */
export function spawnCount(due: readonly unknown[]): number {
  return Math.min(MAX_REVENANTS_PER_ROOM, due.length)
}

/**
 * The counter shown to the player: the due count minus the Revenants rested so far, never below 0.
 * Display only; the backend count replaces it when progress is refetched.
 */
export function remainingDue(dueCount: number, rested: number): number {
  const n = Number.isFinite(dueCount) ? Math.max(0, Math.floor(dueCount)) : 0
  const r = Number.isFinite(rested) ? Math.max(0, Math.floor(rested)) : 0
  return Math.max(0, n - r)
}

/** The Revenants for one room: its due reviews, limited to 3, in the order received. */
export function spawnsForRoom(due: readonly DueReview[], roomId: string): RevenantSpawn[] {
  return due
    .filter((d) => d.room_id === roomId)
    .slice(0, MAX_REVENANTS_PER_ROOM)
    .map((d) => ({ id: d.id, questionId: d.question.id }))
}
