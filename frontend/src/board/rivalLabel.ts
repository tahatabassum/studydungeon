import { RIVAL_LABEL } from '../leaderboard/view'
import type { BoardEntry } from '../types/api'

/** "Ghost Rival - demo" for a seeded mock/offline rival; null for every real player (the flag never exists in real mode). */
export const rivalLabelOf = (e: Pick<BoardEntry, 'is_seeded_rival'>): string | null => (e.is_seeded_rival ? RIVAL_LABEL : null)
