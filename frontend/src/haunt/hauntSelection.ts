/**
 * MOCK-ONLY Daily Haunt selection (D9). The Backend builds the real one. Pure.
 * Only items with `due_at` at or before `now` are chosen, ordered by `due_at` (ties by id), at most `cap`.
 */
export const HAUNT_CAP = 8

export interface Schedulable {
  id: string
  /** ISO timestamp. */
  due_at: string
}

export interface HauntSelection<T extends Schedulable> {
  selected: T[]
  /** Earliest `due_at` after `now`, or null when nothing is scheduled later. */
  next_due_at: string | null
}

export function selectDailyHaunt<T extends Schedulable>(
  items: readonly T[],
  nowMs: number,
  cap: number = HAUNT_CAP,
): HauntSelection<T> {
  const dated = items
    .map((item) => ({ item, at: Date.parse(item.due_at) }))
    .filter((x) => Number.isFinite(x.at))
  const due = dated
    .filter((x) => x.at <= nowMs)
    .sort((a, b) => a.at - b.at || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0))
  const later = dated.filter((x) => x.at > nowMs).sort((a, b) => a.at - b.at)
  return {
    selected: due.slice(0, Math.max(0, cap)).map((x) => x.item),
    next_due_at: later.length > 0 ? later[0].item.due_at : null,
  }
}
