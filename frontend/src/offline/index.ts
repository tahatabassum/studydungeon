import type { ApiClient } from '../api/ApiClient'
import { createAdapter, type OfflineOptions } from './adapter'

export { OFFLINE_DUNGEON_ID, OFFLINE_RIVALS } from './adapter'
export type { OfflineOptions } from './adapter'

/**
 * The Offline_Adapter for the Offline demo. LOADED ONLY through the explicit choice handler, with a dynamic
 * `import('@/offline')` (D15). Nothing outside `src/offline` and tests may import this module statically.
 *
 * Deterministic: pass your own clock and id source to get identical output for identical answers. The
 * defaults use `Date.now` for timestamps only and a counter for ids.
 */
export function createOfflineAdapter(options: Partial<OfflineOptions> = {}): ApiClient {
  let counter = 0
  return createAdapter({
    now: options.now ?? (() => Date.now()),
    nextId: options.nextId ?? ((prefix) => `offline-${prefix}-${(counter += 1)}`),
    ...(options.delayMs !== undefined ? { delayMs: options.delayMs } : {}),
  })
}
