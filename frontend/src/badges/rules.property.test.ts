import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { evaluateBadges, mergeBadges, type RunStats } from './rules'

const room = fc.record({
  correct: fc.integer({ min: 0, max: 12 }),
  wrong: fc.integer({ min: 0, max: 6 }),
  damageTaken: fc.integer({ min: 0, max: 60 }),
  cleared: fc.boolean(),
})

const stats: fc.Arbitrary<RunStats> = fc.record({
  rooms: fc.array(room, { maxLength: 8 }),
  correct: fc.integer({ min: 0, max: 80 }),
  wrong: fc.integer({ min: 0, max: 30 }),
  damageTaken: fc.integer({ min: 0, max: 200 }),
  bossCleared: fc.boolean(),
  maxStreak: fc.integer({ min: 0, max: 40 }),
  revenantsCleared: fc.integer({ min: 0, max: 10 }),
  allRoomsCleared: fc.boolean(),
  fastReads: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
})

describe('Property 20: Badge rules', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 20: Badge rules
  // **Validates: Requirements 15.1, 15.2, 15.3**
  it('awards memory_keeper exactly at 3 or more Revenants', () => {
    fc.assert(
      fc.property(stats, fc.boolean(), (s, speed) => {
        expect(evaluateBadges(s, { speedReader: speed }).includes('memory_keeper')).toBe(s.revenantsCleared >= 3)
      }),
      { numRuns: 200 },
    )
  })

  it('awards streak_5 exactly when the best streak is at least 5', () => {
    fc.assert(
      fc.property(stats, (s) => {
        expect(evaluateBadges(s).includes('streak_5')).toBe(s.maxStreak >= 5)
      }),
      { numRuns: 200 },
    )
  })

  it('never awards speed_reader unless it is enabled (and then only with 3 fast reads)', () => {
    fc.assert(
      fc.property(stats, (s) => {
        expect(evaluateBadges(s).includes('speed_reader')).toBe(false)
        expect(evaluateBadges(s, { speedReader: false }).includes('speed_reader')).toBe(false)
        expect(evaluateBadges(s, { speedReader: true }).includes('speed_reader')).toBe((s.fastReads ?? 0) >= 3)
      }),
      { numRuns: 200 },
    )
  })

  it('awards no_damage only when no wrong answer was recorded', () => {
    fc.assert(
      fc.property(stats, (s) => {
        if (evaluateBadges(s).includes('no_damage')) {
          expect(s.wrong).toBe(0)
          expect(s.damageTaken).toBe(0)
        }
        if (s.wrong > 0) expect(evaluateBadges(s)).not.toContain('no_damage')
      }),
      { numRuns: 200 },
    )
  })

  it('awards dungeon_master only together with boss_slayer and no_damage', () => {
    fc.assert(
      fc.property(stats, (s) => {
        const got = evaluateBadges(s)
        if (got.includes('dungeon_master')) {
          expect(got).toContain('boss_slayer')
          expect(got).toContain('no_damage')
          expect(s.allRoomsCleared).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('returns each badge once and is deterministic', () => {
    fc.assert(
      fc.property(stats, (s) => {
        const a = evaluateBadges(s, { speedReader: true })
        expect(new Set(a).size).toBe(a.length)
        expect(evaluateBadges(s, { speedReader: true })).toEqual(a)
      }),
      { numRuns: 100 },
    )
  })
})

describe('badge rules, examples', () => {
  const base: RunStats = {
    rooms: [],
    correct: 0,
    wrong: 0,
    damageTaken: 0,
    bossCleared: false,
    maxStreak: 0,
    revenantsCleared: 0,
    allRoomsCleared: false,
  }

  it('earns nothing for an empty run', () => {
    expect(evaluateBadges(base)).toEqual([])
  })

  it('earns first_blood and perfect_room for one clean cleared room', () => {
    const got = evaluateBadges({ ...base, correct: 3, rooms: [{ correct: 3, wrong: 0, damageTaken: 0, cleared: true }], maxStreak: 3 })
    expect(got).toEqual(['first_blood', 'perfect_room', 'no_damage'])
  })

  it('floors model: dungeon_master needs every floor and the Final_Boss cleared on a clean run', () => {
    const clean = { ...base, correct: 10, bossCleared: true, allRoomsCleared: true, maxStreak: 10 }
    expect(evaluateBadges(clean)).toContain('dungeon_master')
    expect(evaluateBadges({ ...clean, allRoomsCleared: false })).not.toContain('dungeon_master')
    expect(evaluateBadges({ ...clean, wrong: 1, damageTaken: 10 })).not.toContain('dungeon_master')
  })

  it('mergeBadges unions lists in catalog order', () => {
    expect(mergeBadges([['boss_slayer'], undefined, ['first_blood', 'boss_slayer']])).toEqual(['first_blood', 'boss_slayer'])
  })
})

// Only the Mock_Adapter, the Offline_Module and tests may import the rules (the Http_Client path shows the backend list).
const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('badge rules import boundary', () => {
  it('only src/api/mock, src/offline and src/badges itself import badges/rules', () => {
    const hits = Object.keys(sources).filter(
      (f) =>
        !f.startsWith('/src/api/mock/') &&
        !f.startsWith('/src/offline/') &&
        !f.startsWith('/src/badges/') &&
        /from\s*['"][^'"]*badges\/rules['"]|import\(\s*['"][^'"]*badges\/rules['"]/.test(sources[f]),
    )
    expect(hits).toEqual([])
    const users = Object.keys(sources).filter((f) => /badges\/rules['"]/.test(sources[f]))
    expect(users.sort()).toEqual(['/src/api/mock/mockAdapter.ts', '/src/offline/adapter.ts'])
  })
})
