import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { BadgeId, LeaderboardEntry, LeaderboardResponse } from '../types/api'
import { compareEntries, rankEntries } from './ranking'
import { PROVISIONAL_ID, insertProvisional, outrankCount, type PlayerRun } from './provisional'
import { RIVAL_LABEL, buildBoardView } from './view'

const BADGES: BadgeId[] = ['first_blood', 'streak_5', 'boss_slayer']

// Small ranges make ties common, so every level of the comparator is exercised.
const entriesArb = (min = 0, max = 30): fc.Arbitrary<LeaderboardEntry[]> =>
  fc
    .array(
      fc.record({
        display_name: fc.constantFrom('Ada', 'ada', 'Bo', 'Zed', 'Ünal', ''),
        score: fc.integer({ min: 0, max: 4 }),
        accuracy: fc.constantFrom(0, 0.5, 0.75, 1),
        best_streak: fc.integer({ min: 0, max: 3 }),
        is_seeded_rival: fc.boolean(),
        level: fc.integer({ min: 1, max: 9 }),
      }),
      { minLength: min, maxLength: max },
    )
    .map((rows) =>
      rows.map((r, i) => ({
        ...r,
        id: `e${i}`,
        rank: 0,
        is_guest: false,
        badge_ids: BADGES.slice(0, i % 4),
      })),
    )

const runArb: fc.Arbitrary<PlayerRun> = fc.record({
  display_name: fc.constantFrom('Ada', 'Me', 'Zed'),
  level: fc.integer({ min: 1, max: 9 }),
  score: fc.integer({ min: 0, max: 4 }),
  accuracy: fc.constantFrom(0, 0.5, 0.75, 1),
  best_streak: fc.integer({ min: 0, max: 3 }),
})

const shuffled = <T>(xs: readonly T[]): fc.Arbitrary<T[]> => fc.shuffledSubarray([...xs], { minLength: xs.length, maxLength: xs.length })

function respond(entries: LeaderboardEntry[], me: LeaderboardResponse['me'] = { rank: null, is_provisional: false, entry: null }): LeaderboardResponse {
  return { entries, me, updated_at: '2026-01-01T00:00:00.000Z' }
}

describe('Property 14: Ranking is a total, permutation-invariant order', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 14: Ranking is a total, permutation-invariant order
  // **Validates: Requirements 11.5**
  it('gives the same sequence for any permutation, unique ranks 1..n, and adjacent pairs in comparator order', () => {
    fc.assert(
      fc.property(
        entriesArb().chain((es) => fc.tuple(fc.constant(es), shuffled(es))),
        ([entries, permuted]) => {
          const a = rankEntries(entries)
          const b = rankEntries(permuted)
          expect(b.map((e) => e.id)).toEqual(a.map((e) => e.id))
          expect(a.map((e) => e.rank)).toEqual(a.map((_, i) => i + 1))
          for (let i = 1; i < a.length; i += 1) {
            const prev = a[i - 1]
            const cur = a[i]
            expect(compareEntries(prev, cur)).toBeLessThan(0)
            if (prev.score === cur.score && prev.accuracy === cur.accuracy && prev.best_streak === cur.best_streak) {
              // Name ascending in code-point order, then id ascending.
              expect(prev.display_name <= cur.display_name).toBe(true)
              if (prev.display_name === cur.display_name) expect(prev.id < cur.id).toBe(true)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('does not mutate its input', () => {
    fc.assert(
      fc.property(entriesArb(1, 10), (entries) => {
        const copy = structuredClone(entries)
        rankEntries(entries)
        expect(entries).toEqual(copy)
      }),
      { numRuns: 30 },
    )
  })
})

describe('Property 15: Provisional rank insertion', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 15: Provisional rank insertion
  // **Validates: Requirements 11.7**
  it('adds exactly one entry, stays sorted, and ranks the run 1 plus the entries that outrank it', () => {
    fc.assert(
      fc.property(entriesArb(), runArb, (entries, run) => {
        const ranked = rankEntries(entries)
        const out = insertProvisional(ranked, run)
        expect(out.entries).toHaveLength(ranked.length + 1)
        expect(out.entries.filter((e) => e.id === PROVISIONAL_ID)).toHaveLength(1)
        expect(out.entries.map((e) => e.rank)).toEqual(out.entries.map((_, i) => i + 1))
        for (let i = 1; i < out.entries.length; i += 1) {
          expect(compareEntries(out.entries[i - 1], out.entries[i])).toBeLessThan(0)
        }
        expect(out.rank).toBe(1 + outrankCount(ranked, run))
        expect(out.entries[out.rank - 1].id).toBe(PROVISIONAL_ID)
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 16: Board view pins me and labels rivals', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 16: Board view pins me and labels rivals
  // **Validates: Requirements 11.6, 11.9**
  it('pins a highlighted row for a stored entry (even outside the limit) and labels exactly the rivals', () => {
    fc.assert(
      fc.property(entriesArb(1, 30), fc.integer({ min: 0, max: 29 }), fc.integer({ min: 1, max: 12 }), (entries, pick, limit) => {
        const ranked = rankEntries(entries)
        const mine = ranked[pick % ranked.length]
        const view = buildBoardView(respond(ranked, { rank: mine.rank, is_provisional: false, entry: mine }), { limit })
        expect(view.meRow).not.toBeNull()
        expect(view.meRow?.entry.id).toBe(mine.id)
        expect(view.meRow?.isMe).toBe(true)
        expect(view.meRow?.rank).toBe(mine.rank)
        const shown = [...view.podium, ...view.rows]
        expect(shown.length).toBe(Math.min(limit, ranked.length))
        expect(shown.filter((r) => r.isMe).length).toBe(shown.some((r) => r.entry.id === mine.id) ? 1 : 0)
        for (const r of [...shown, view.meRow!]) {
          expect(r.label === RIVAL_LABEL).toBe(r.entry.is_seeded_rival)
          expect(r.label === null).toBe(!r.entry.is_seeded_rival)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('pins a provisional row for a run when there is no stored entry', () => {
    fc.assert(
      fc.property(entriesArb(0, 25), runArb, fc.integer({ min: 1, max: 10 }), (entries, run, limit) => {
        const view = buildBoardView(respond(entries), { limit, run })
        expect(view.meRow?.provisional).toBe(true)
        expect(view.meRow?.entry.id).toBe(PROVISIONAL_ID)
        expect(view.meRow?.rank).toBe(1 + outrankCount(rankEntries(entries), run))
        expect(view.podium.length).toBeLessThanOrEqual(3)
        expect(view.podium.length + view.rows.length).toBeLessThanOrEqual(limit)
      }),
      { numRuns: 100 },
    )
  })

  it('has no pinned row without a stored entry or a run', () => {
    const view = buildBoardView(respond([]))
    expect(view.meRow).toBeNull()
    expect(view.podium).toEqual([])
    expect(view.rows).toEqual([])
  })
})
