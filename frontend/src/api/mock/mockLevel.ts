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

/** Reads `?mockLevel=N` from the current page URL (dev builds only). */
export function readMockLevel(): number | undefined {
  if (typeof window === 'undefined') return undefined
  return parseMockLevel(window.location.search, import.meta.env.DEV)
}
