import type { BoardMe } from '../types/api'

export type YouPanelKind = 'first_points' | 'ranked'

export interface YouPanelView {
  kind: YouPanelKind
  rank: number | null
  points: number
  /** "N points to pass <handle>": present exactly when the Backend sent `next_above`. */
  passLine: { handle: string; pointsNeeded: number } | null
  /** "N points to enter the top 20": present exactly when the player is not in the top 20. */
  enterLine: { pointsNeeded: number } | null
  /** A Guest who can upgrade is offered a way to keep the rank. */
  cta: 'upgrade' | null
}

/** Shows the numbers of the `me` block exactly as the Backend sent them (D18). Null without a session. */
export function youPanelView(me: BoardMe | null, opts: { isGuest: boolean; canUpgrade: boolean }): YouPanelView | null {
  if (!me) return null
  return {
    kind: me.rank === null || me.reason === 'no_points_yet' ? 'first_points' : 'ranked',
    rank: me.rank,
    points: me.points,
    passLine: me.next_above ? { handle: me.next_above.handle, pointsNeeded: me.next_above.points_needed } : null,
    enterLine: me.top20.in_top20 ? null : { pointsNeeded: me.top20.points_needed },
    cta: opts.isGuest && opts.canUpgrade ? 'upgrade' : null,
  }
}
