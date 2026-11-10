/**
 * Dev-only `?mockLevel=N` override for the Mock_Adapter's player level (1 to 99), so each weapon
 * can be seen without grinding XP. Returns undefined when not in dev, absent or not a whole number.
 */
export function parseMockLevel(search: string, dev: boolean): number | undefined {
  if (!dev) return undefined
  const raw = new URLSearchParams(search).get('mockLevel')
  if (raw === null || !/^\d{1,2}$/.test(raw)) return undefined
  const n = Number(raw)
  return n >= 1 ? n : undefined
}

/** Dev-only `?mockPlayer=1`: the demo session is a signed-in player (runs are stored on the board). */
export function parseMockPlayer(search: string, dev: boolean): boolean {
  return dev && new URLSearchParams(search).get('mockPlayer') === '1'
}

/** Dev-only `VITE_MOCK_DELAY_MS`: extra latency (0 to 60000 ms) on the mock demo session. 0 outside dev or when invalid. */
export function parseMockDelay(raw: string | undefined, dev: boolean): number {
  if (!dev || raw === undefined || !/^\d{1,5}$/.test(raw)) return 0
  return Math.min(60_000, Number(raw))
}

export function readMockDelayMs(): number {
  return parseMockDelay(import.meta.env.VITE_MOCK_DELAY_MS, import.meta.env.DEV)
}

/** Reads `?mockPlayer=1` from the current page URL (dev builds only). */
export function readMockPlayer(): boolean {
  if (typeof window === 'undefined') return false
  return parseMockPlayer(window.location.search, import.meta.env.DEV)
}

/** Reads `?mockLevel=N` from the current page URL (dev builds only). */
export function readMockLevel(): number | undefined {
  if (typeof window === 'undefined') return undefined
  return parseMockLevel(window.location.search, import.meta.env.DEV)
}
