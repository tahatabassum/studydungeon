import { useSyncExternalStore } from 'react'

/**
 * Runs finished in this tab, in memory only (nothing is persisted). A guest has no stored board entry,
 * so the board and the Dashboard use these for the provisional rank and provisional stats.
 */
export interface FinishedRun {
  dungeonId: string
  score: number
  /** Ratio from 0 to 1. */
  accuracy: number
  bestStreak: number
  xp: number
  finishedAt: number
}

const MAX_RUNS = 20
let runs: readonly FinishedRun[] = []
const listeners = new Set<() => void>()

export function recordFinishedRun(run: FinishedRun): void {
  runs = [run, ...runs].slice(0, MAX_RUNS)
  for (const l of listeners) l()
}

export function getFinishedRuns(): readonly FinishedRun[] {
  return runs
}

/** Test helper. */
export function clearFinishedRuns(): void {
  runs = []
  for (const l of listeners) l()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function useFinishedRuns(): readonly FinishedRun[] {
  return useSyncExternalStore(subscribe, getFinishedRuns, getFinishedRuns)
}

/** The run with the highest score (ties: higher accuracy, then longer streak), or null. */
export function bestFinishedRun(list: readonly FinishedRun[], dungeonId?: string): FinishedRun | null {
  let best: FinishedRun | null = null
  for (const r of list) {
    if (dungeonId !== undefined && r.dungeonId !== dungeonId) continue
    if (
      best === null ||
      r.score > best.score ||
      (r.score === best.score && (r.accuracy > best.accuracy || (r.accuracy === best.accuracy && r.bestStreak > best.bestStreak)))
    ) {
      best = r
    }
  }
  return best
}
