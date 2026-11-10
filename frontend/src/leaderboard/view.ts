import type { LeaderboardEntry, LeaderboardResponse } from '../types/api'
import { insertProvisional, type PlayerRun } from './provisional'
import { rankEntries } from './ranking'

export const RIVAL_LABEL = 'Ghost Rival - demo'
export const DEFAULT_LIMIT = 20
export const PODIUM_SIZE = 3

export interface BoardRow {
  entry: LeaderboardEntry
  /** Shown rank: the position in the comparator order (the backend orders by the same rule). */
  rank: number
  isMe: boolean
  /** "Ghost Rival - demo" exactly when the entry is a seeded rival, else null. */
  label: string | null
}

export interface BoardView {
  /** The first three rows, in rank order. */
  podium: BoardRow[]
  /** The rows after the podium, up to the limit. */
  rows: BoardRow[]
  /** The player's pinned, highlighted row: stored or provisional. Present even when outside the limit. */
  meRow: (BoardRow & { provisional: boolean }) | null
}

export interface BoardOptions {
  limit?: number
  /** The player's latest run, used for the provisional rank when the response holds no stored entry. */
  run?: PlayerRun | null
}

const labelOf = (e: LeaderboardEntry): string | null => (e.is_seeded_rival ? RIVAL_LABEL : null)

/**
 * Board view (Req 11.4, 11.6, 11.7, 11.9). Entries are ordered by the ranking comparator. The player's row
 * comes from `response.me.entry`, or, when there is none and a run is given, from a provisional insert.
 */
export function buildBoardView(response: LeaderboardResponse, options: BoardOptions = {}): BoardView {
  const limit = Math.max(0, Math.floor(options.limit ?? DEFAULT_LIMIT))
  const stored = response.me.entry
  let ordered = rankEntries(response.entries)
  let meId: string | null = stored ? stored.id : null
  let meRow: BoardView['meRow'] = null

  if (stored) {
    const position = ordered.find((e) => e.id === stored.id)
    const rank = response.me.rank ?? position?.rank ?? stored.rank
    meRow = { entry: stored, rank, isMe: true, label: labelOf(stored), provisional: response.me.is_provisional }
  } else if (options.run) {
    const inserted = insertProvisional(ordered, options.run)
    ordered = inserted.entries
    meId = inserted.entry.id
    meRow = { entry: inserted.entry, rank: inserted.rank, isMe: true, label: null, provisional: true }
  }

  const toRow = (e: LeaderboardEntry): BoardRow => ({
    entry: e,
    rank: e.rank,
    isMe: e.id === meId,
    label: labelOf(e),
  })
  const shown = ordered.slice(0, limit).map(toRow)
  return { podium: shown.slice(0, PODIUM_SIZE), rows: shown.slice(PODIUM_SIZE), meRow }
}
