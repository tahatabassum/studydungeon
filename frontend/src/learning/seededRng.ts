/**
 * MOCK-ONLY seeded randomness (D3). Real mode never draws; the Backend picks the questions.
 * Pure and deterministic: the same seed always gives the same sequence.
 */

/** FNV-1a 32-bit hash of a string. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 generator: returns a function giving floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A generator seeded from a run seed string. */
export function rngFromSeed(seed: string): () => number {
  return mulberry32(fnv1a(seed))
}
