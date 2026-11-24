import type { BoardEntry, BoardResponse } from '../types/api'

export interface LiveBoardView {
  /** The first up to three entries, in the order received. */
  podium: BoardEntry[]
  /** The remaining entries, in the order received. */
  rows: BoardEntry[]
  /** Every entry (the Standings list), in the order received. */
  all: BoardEntry[]
  empty: boolean
}

/**
 * Splits the board for display. The Backend sends the order and the ranks (D17): nothing here sorts,
 * re-ranks, filters or computes a number.
 */
export function buildLiveBoardView(res: Pick<BoardResponse, 'entries'>): LiveBoardView {
  return { podium: res.entries.slice(0, 3), rows: res.entries.slice(3), all: [...res.entries], empty: res.entries.length === 0 }
}
