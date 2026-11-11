/** Typed reads of the VITE_* flags (the only place that touches import.meta.env for flags). */

export interface FlagEnv {
  VITE_USE_MOCKS?: string
  VITE_API_BASE?: string
  VITE_API_BASE_URL?: string
  VITE_MOCK_SEED_REVENANTS?: string
  VITE_BADGE_SPEED_READER?: string
  VITE_MOCK_PLAYER_COUNT?: string
}

const isTrue = (v: string | undefined): boolean => v === 'true'

function parseCount(v: string | undefined): number {
  const n = Number(v)
  return v !== undefined && v.trim() !== '' && Number.isInteger(n) && n > 0 ? n : 0
}
export interface Flags {
  /** Mock_Adapter instead of the real backend. */
  useMocks: boolean
  /** Base URL of the real backend ('' means same origin). */
  apiBaseUrl: string
  /** Mock seeds due reviews for demos (used from Phase 4). */
  mockSeedRevenants: boolean
  /** D19: Speed Reader badge, off by default. */
  badgeSpeedReader: boolean
  /** Mock only (D21): the player count the mock reports. 0 unless set. */
  mockPlayerCount: number
}

export function readFlags(env: FlagEnv = import.meta.env): Flags {
  return {
    useMocks: isTrue(env.VITE_USE_MOCKS),
    // VITE_API_BASE (the Day 3 runbook name) wins; VITE_API_BASE_URL is the older name. Empty means unset.
    apiBaseUrl: env.VITE_API_BASE || env.VITE_API_BASE_URL || '',
    mockSeedRevenants: isTrue(env.VITE_MOCK_SEED_REVENANTS),
    badgeSpeedReader: isTrue(env.VITE_BADGE_SPEED_READER),
    mockPlayerCount: parseCount(env.VITE_MOCK_PLAYER_COUNT),
  }
}
