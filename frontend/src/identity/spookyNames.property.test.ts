import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  SPOOKY_ADJECTIVES,
  SPOOKY_CREATURES,
  randomSpookyName,
  rollAnother,
} from './spookyNames'
import { checkLocalName } from './nameRules'

// Mirrors backend/app/core/identity.py (read-only reference).
const RESERVED = [
  'admin', 'administrator', 'mod', 'moderator', 'staff', 'support', 'system', 'root',
  'official', 'studydungeon', 'kiro', 'ghostrival', 'ghost_rival', 'guest', 'anonymous',
  'null', 'undefined', 'examwarden',
]
const PROFANE = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'bastard', 'nigger', 'faggot']
const LOOKALIKES: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's',
}

function normalizeForModeration(name: string): string {
  let n = name.normalize('NFKC').toLowerCase()
  for (const [c, m] of Object.entries(LOOKALIKES)) n = n.split(c).join(m)
  return n.replace(/[\s_-]+/g, '')
}

const rngArb: fc.Arbitrary<() => number> = fc
  .array(
    fc.oneof(
      fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
      fc.constantFrom(0, 0.9999999),
    ),
    { minLength: 1, maxLength: 8 },
  )
  .map((seq) => {
    let i = 0
    return () => seq[i++ % seq.length]
  })

const spookyArb = rngArb.map((rng) => randomSpookyName(rng))

describe('Feature: frontend-10-live-players, Property 18: Spooky names always pass the local rules', () => {
  // **Validates: Requirements 2.4, 2.5**
  it('randomSpookyName passes local and backend moderation rules', () => {
    fc.assert(
      fc.property(rngArb, (rng) => {
        const name = randomSpookyName(rng)
        expect(checkLocalName(name).ok).toBe(true)
        expect(name.length).toBeLessThanOrEqual(16)
        expect(name).toMatch(/^[A-Za-z]+ [A-Za-z]+$/)
        const norm = normalizeForModeration(name)
        for (const w of [...RESERVED, ...PROFANE]) expect(norm.includes(w)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('every adjective/creature combination is safe', () => {
    for (const a of SPOOKY_ADJECTIVES) {
      for (const c of SPOOKY_CREATURES) {
        const name = `${a} ${c}`
        expect(checkLocalName(name).ok).toBe(true)
        const norm = normalizeForModeration(name)
        for (const w of [...RESERVED, ...PROFANE]) expect(norm.includes(w)).toBe(false)
      }
    }
  })

  it('randomSpookyName never returns the excluded spooky name', () => {
    fc.assert(
      fc.property(rngArb, spookyArb, (rng, exclude) => {
        expect(randomSpookyName(rng, exclude)).not.toBe(exclude)
      }),
      { numRuns: 200 },
    )
  })

  it('rollAnother never returns the current name', () => {
    fc.assert(
      fc.property(rngArb, spookyArb, (rng, current) => {
        expect(rollAnother(current, rng)).not.toBe(current)
      }),
      { numRuns: 200 },
    )
  })
})
