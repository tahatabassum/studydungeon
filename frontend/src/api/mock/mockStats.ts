import type { PlayerStats } from '../../types/api'
import { readFlags } from '../../config/flags'

/** MOCK-ONLY (frontend-10 D21): the configured count, else 0, so a mock deployment never shows an invented number. */
export function mockPlayerStats(count: number = readFlags().mockPlayerCount): PlayerStats {
  return { players: count, updated_at: new Date().toISOString(), cache_seconds: 300 }
}
