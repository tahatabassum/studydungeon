import { capabilityOf, type ApiClient } from '../api/ApiClient'
import { registerCacheReset } from '../state/resetClientCaches'

export const DEFAULT_TTL_MS = 300_000

/** True when there is no cached value or the TTL has elapsed. */
export function shouldRefetch(fetchedAt: number | null, now: number, ttlMs: number): boolean {
  return fetchedAt === null || now - fetchedAt >= ttlMs
}

let cached: { players: number; fetchedAt: number; ttlMs: number } | null = null
let inFlight: Promise<number | null> | null = null

/**
 * The player count, from the in-memory cache while valid. A failure (or an unsupported endpoint) returns
 * null and is never cached. Concurrent calls share one request.
 */
export function fetchPlayerCount(api: Pick<ApiClient, 'getPlayerStats' | 'capabilities'>, now: () => number = Date.now): Promise<number | null> {
  if (cached && !shouldRefetch(cached.fetchedAt, now(), cached.ttlMs)) return Promise.resolve(cached.players)
  if (capabilityOf(api, 'playerCounter') === 'off') return Promise.resolve(null)
  if (inFlight) return inFlight
  const p = api
    .getPlayerStats()
    .then((s) => {
      const ttlMs = typeof s.cache_seconds === 'number' && s.cache_seconds >= 0 ? s.cache_seconds * 1000 : DEFAULT_TTL_MS
      cached = { players: s.players, fetchedAt: now(), ttlMs }
      return s.players
    })
    .catch(() => null)
    .finally(() => {
      if (inFlight === p) inFlight = null
    })
  inFlight = p
  return p
}

export function resetCounterCache(): void {
  cached = null
  inFlight = null
}

registerCacheReset(resetCounterCache)
