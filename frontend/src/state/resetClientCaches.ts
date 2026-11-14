import { clearFinishedRuns } from '../leaderboard/sessionRuns'
import { setEquippedWeapon } from '../weapons/equipped'

const extra = new Set<() => void>()

/**
 * Registration point for in-memory caches added by later phases (packs, board, counter, quota).
 * Returns an unregister function. Each reset runs on `resetClientCaches()`.
 */
export function registerCacheReset(reset: () => void): () => void {
  extra.add(reset)
  return () => {
    extra.delete(reset)
  }
}

/** Clears every in-memory client cache (D12). Called after the account is deleted. Nothing is persisted. */
export function resetClientCaches(): void {
  clearFinishedRuns()
  setEquippedWeapon(null)
  for (const reset of extra) {
    try {
      reset()
    } catch {
      // One failing cache must not keep the others from clearing.
    }
  }
}
