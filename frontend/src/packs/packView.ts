import type { Pack, PacksResponse } from '../types/api'

/** Pure pack helpers (frontend-10 D14). The Backend owns status; these only read it. */

const byOrder = (a: Pack, b: Pack): number => a.order - b.order

/**
 * The pack to play: `next_pack_id` when it names a playable pack, else the first `in_progress` or `available`
 * pack by order. When every pack is completed it returns the pack with the lowest order. Null for an empty list.
 * A `locked` pack is never returned, and a `completed` one only when all are completed.
 */
export function currentPack(res: Pick<PacksResponse, 'packs' | 'next_pack_id'>): Pack | null {
  const sorted = [...res.packs].sort(byOrder)
  if (sorted.length === 0) return null
  const named = res.next_pack_id ? sorted.find((p) => p.id === res.next_pack_id) : undefined
  if (named && (named.status === 'available' || named.status === 'in_progress')) return named
  const open = sorted.find((p) => p.status === 'available' || p.status === 'in_progress')
  if (open) return open
  return sorted.every((p) => p.status === 'completed') ? sorted[0] : null
}

/** The packs that went from `locked` to `available` between two lists, in pack order. */
export function unlockedBetween(before: readonly Pack[], after: readonly Pack[]): Pack[] {
  const was = new Map(before.map((p) => [p.id, p.status]))
  return after
    .filter((p) => was.get(p.id) === 'locked' && p.status === 'available')
    .sort(byOrder)
}

/** "Pack 2 of 3". */
export function packLabel(pack: Pick<Pack, 'order'>, total: number): string {
  return `Pack ${pack.order} of ${total}`
}
