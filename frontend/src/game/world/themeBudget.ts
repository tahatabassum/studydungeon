import { MAX_PARTICLES, type RoomTheme } from './roomTheme'

export const AMBIENT_CAP = MAX_PARTICLES
export const PIECE_CAP = 24
export const ROOM_TOTAL_CAP = 48
export const REDUCED_AMBIENT_CAP = 4

/** Piece kinds that are not shown at all under reduced motion (bats stay roosted). */
const HIDDEN_WHEN_REDUCED = new Set(['steam', 'lightning'])

/** Visible object counts for a theme. Pure. Pieces are held in a fixed pose when reduced. */
export function themeBudget(
  theme: RoomTheme,
  reduced: boolean,
): { ambient: number; pieces: number; total: number } {
  const ambient = Math.min(theme.particles.count, reduced ? REDUCED_AMBIENT_CAP : AMBIENT_CAP)
  let pieces = 0
  for (const p of theme.pieces) {
    if (reduced && HIDDEN_WHEN_REDUCED.has(p.kind)) continue
    pieces += p.count
  }
  return { ambient, pieces, total: ambient + pieces }
}
