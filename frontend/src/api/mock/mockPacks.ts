import type { Pack, PackProgress, PacksResponse } from '../../types/api'

/**
 * MOCK-ONLY preloaded packs (frontend-10 D14, PROPOSED). Pack 1 is the seeded demo dungeon; Packs 2 and 3 are
 * placeholder content built by the generated-dungeon builder and carry `sample: true`.
 * Rule: Pack N+1 unlocks when the final boss of Pack N is cleared.
 */
export interface PackDef {
  id: string
  order: number
  title: string
  description: string
  dungeonId: string
  sample: boolean
}

/** The stored part of a pack. Progress numbers are derived by the adapter from play state. */
export type PackStatuses = ReadonlyMap<string, Pack['status']>

/** Pack 1 starts available, every other pack locked. */
export function initialStatuses(defs: readonly PackDef[]): Map<string, Pack['status']> {
  const sorted = [...defs].sort((a, b) => a.order - b.order)
  return new Map(sorted.map((d, i) => [d.id, i === 0 ? 'available' : 'locked']))
}

/**
 * Applies the clear of a pack's final boss (pure). The pack becomes `completed`; the next pack (by order) becomes
 * `available` only if it was `locked`. Clearing a completed pack again changes nothing and unlocks nothing.
 */
export function applyPackClear(
  defs: readonly PackDef[],
  statuses: PackStatuses,
  packId: string,
): { statuses: Map<string, Pack['status']>; progress: PackProgress } {
  const sorted = [...defs].sort((a, b) => a.order - b.order)
  const next = new Map(statuses)
  const index = sorted.findIndex((d) => d.id === packId)
  let unlocked: string | null = null
  if (index >= 0 && next.get(packId) !== 'completed') {
    next.set(packId, 'completed')
    const following = sorted[index + 1]
    if (following && next.get(following.id) === 'locked') {
      next.set(following.id, 'available')
      unlocked = following.id
    }
  }
  const allCompleted = sorted.length > 0 && sorted.every((d) => next.get(d.id) === 'completed')
  return {
    statuses: next,
    progress: { pack_id: packId, status: next.get(packId) ?? 'locked', unlocked_pack_id: unlocked, all_completed: allCompleted },
  }
}

export interface PackProgressNumbers {
  floorsTotal: number
  floorsCleared: number
  points: number
}

/** Builds the `GET /packs` response from the stored statuses plus derived numbers. */
export function buildPacksResponse(
  defs: readonly PackDef[],
  statuses: PackStatuses,
  numbersOf: (def: PackDef) => PackProgressNumbers,
): PacksResponse {
  const sorted = [...defs].sort((a, b) => a.order - b.order)
  const packs: Pack[] = sorted.map((d) => {
    const stored = statuses.get(d.id) ?? 'locked'
    const n = numbersOf(d)
    const status: Pack['status'] = stored === 'available' && (n.floorsCleared > 0 || n.points > 0) ? 'in_progress' : stored
    return {
      id: d.id,
      order: d.order,
      title: d.title,
      description: d.description,
      dungeon_id: d.dungeonId,
      floors_total: n.floorsTotal,
      floors_cleared: n.floorsCleared,
      final_boss_cleared: stored === 'completed',
      status,
      points_earned: n.points,
      ...(d.sample ? { sample: true } : {}),
    }
  })
  const open = packs.find((p) => p.status === 'available' || p.status === 'in_progress')
  return {
    packs,
    next_pack_id: open?.id ?? null,
    all_completed: packs.length > 0 && packs.every((p) => p.status === 'completed'),
  }
}
