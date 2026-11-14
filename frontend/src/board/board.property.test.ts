import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { buildLiveBoardView } from './boardView'
import { youPanelView } from './youPanel'
import { formatCountdown, remainingSeconds } from './countdown'
import { MIN_BOARD_INTERVAL_MS, REFETCH_JITTER_MS, nextPollDelay } from './pollScheduler'
import type { BoardEntry, BoardMe } from '../types/api'

const RUNS = { numRuns: 200 }

const entryArb = (rank: number): fc.Arbitrary<BoardEntry> =>
  fc.record({
    rank: fc.constant(rank),
    public_id: fc.string({ minLength: 1, maxLength: 8 }),
    handle: fc.string({ maxLength: 12 }),
    is_guest: fc.boolean(),
    level: fc.nat(30),
    points: fc.nat(100000),
    rooms_cleared: fc.nat(500),
  })

// Feature: frontend-10-live-players, Property 8: The board view keeps the server order
// **Validates: Requirements 11.5**
describe('Property 8: The board view keeps the server order', () => {
  it('podium is the first min(3, n) entries, rows the rest, nothing dropped, re-sorted or re-ranked', () => {
    const entries = fc
      .integer({ min: 0, max: 20 })
      .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => entryArb(i + 1))))
    fc.assert(
      fc.property(entries, (list) => {
        const view = buildLiveBoardView({ entries: list })
        expect(view.podium).toHaveLength(Math.min(3, list.length))
        expect([...view.podium, ...view.rows]).toEqual(list)
        expect(view.empty).toBe(list.length === 0)
      }),
      RUNS,
    )
  })
})

const meArb: fc.Arbitrary<BoardMe> = fc
  .record({
    rank: fc.option(fc.integer({ min: 1, max: 5000 }), { nil: null }),
    points: fc.nat(1_000_000),
    aboveHandle: fc.string({ maxLength: 12 }),
    aboveNeeded: fc.integer({ min: 1, max: 100000 }),
    cutoff: fc.nat(100000),
    needed: fc.nat(100000),
    withReason: fc.boolean(),
  })
  .map((r) => {
    const inTop = r.rank !== null && r.rank <= 20
    return {
      live: true,
      rank: r.rank,
      points: r.points,
      next_above:
        r.rank !== null && r.rank > 1
          ? { rank: r.rank - 1, handle: r.aboveHandle, points: r.points + r.aboveNeeded - 1, points_needed: r.aboveNeeded }
          : null,
      top20: { in_top20: inTop, cutoff_points: r.cutoff, points_needed: inTop ? 0 : r.needed },
      ...(r.rank === null && r.withReason ? { reason: 'no_points_yet' } : {}),
    }
  })

// Feature: frontend-10-live-players, Property 10: The You panel shows exactly the numbers from the Backend
// **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.10**
describe('Property 10: The You panel shows exactly the numbers from the Backend', () => {
  it('copies rank, points and the needed numbers unchanged', () => {
    fc.assert(
      fc.property(meArb, fc.boolean(), fc.boolean(), (me, isGuest, canUpgrade) => {
        const v = youPanelView(me, { isGuest, canUpgrade })!
        expect(v.rank).toBe(me.rank)
        expect(v.points).toBe(me.points)
        expect(v.kind).toBe(me.rank === null ? 'first_points' : 'ranked')
        if (me.next_above) expect(v.passLine).toEqual({ handle: me.next_above.handle, pointsNeeded: me.next_above.points_needed })
        else expect(v.passLine).toBeNull()
        if (me.rank === 1) expect(v.passLine).toBeNull()
        if (me.top20.in_top20) expect(v.enterLine).toBeNull()
        else expect(v.enterLine).toEqual({ pointsNeeded: me.top20.points_needed })
        expect(v.cta === 'upgrade').toBe(isGuest && canUpgrade)
      }),
      RUNS,
    )
  })

  it('returns null without a session and first_points for reason no_points_yet', () => {
    expect(youPanelView(null, { isGuest: true, canUpgrade: true })).toBeNull()
    const me: BoardMe = {
      live: true,
      rank: null,
      points: 0,
      next_above: null,
      top20: { in_top20: false, cutoff_points: 1120, points_needed: 1121 },
      reason: 'no_points_yet',
    }
    expect(youPanelView(me, { isGuest: false, canUpgrade: false })).toMatchObject({ kind: 'first_points', enterLine: { pointsNeeded: 1121 } })
  })
})

// Feature: frontend-10-live-players, Property 11: Countdown text is monotone and clamped
// **Validates: Requirements 13.2**
describe('Property 11: Countdown text is monotone and clamped', () => {
  const t = fc.integer({ min: 0, max: 10 ** 10 })
  it('is monotone, clamped to 0:00 and parses back to the remaining seconds under an hour', () => {
    fc.assert(
      fc.property(t, t, t, (target, a, b) => {
        const [n1, n2] = a <= b ? [a, b] : [b, a]
        expect(remainingSeconds(target, n2)).toBeLessThanOrEqual(remainingSeconds(target, n1))
        if (n2 >= target) expect(formatCountdown(target, n2)).toBe('0:00')
        const secs = remainingSeconds(target, n1)
        const text = formatCountdown(target, n1)
        if (secs < 3600) {
          const m = /^(\d+):(\d\d)$/.exec(text)!
          expect(Number(m[1]) * 60 + Number(m[2])).toBe(secs)
        } else {
          const m = /^(\d+):(\d\d):(\d\d)$/.exec(text)!
          expect(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])).toBe(secs)
        }
      }),
      RUNS,
    )
  })
})

// Feature: frontend-10-live-players, Property 12: Poll scheduling never polls too early
// **Validates: Requirements 13.3, 13.4, 13.5, 13.6, 13.7**
describe('Property 12: Poll scheduling never polls too early', () => {
  const ms = fc.integer({ min: 0, max: 10 ** 9 })
  it('is null when hidden, zero on a first load, and never before the three limits', () => {
    fc.assert(
      fc.property(
        ms,
        ms,
        ms,
        fc.option(ms, { nil: null }),
        fc.integer({ min: 0, max: REFETCH_JITTER_MS }),
        fc.boolean(),
        (now, nextRefreshAt, lastFetchAt, retryAfterUntil, jitterMs, visible) => {
          const state = { now, nextRefreshAt, lastFetchAt, visible, retryAfterUntil, jitterMs }
          const d = nextPollDelay(state)
          if (!visible) {
            expect(d).toBeNull()
            return
          }
          expect(d).not.toBeNull()
          expect(d!).toBeGreaterThanOrEqual(0)
          const at = now + d!
          expect(at).toBeGreaterThanOrEqual(nextRefreshAt)
          expect(at).toBeGreaterThanOrEqual(lastFetchAt + MIN_BOARD_INTERVAL_MS)
          if (retryAfterUntil !== null) expect(at).toBeGreaterThanOrEqual(retryAfterUntil)
          expect(nextPollDelay({ ...state, lastFetchAt: null, nextRefreshAt: null, retryAfterUntil: null })).toBe(0)
        },
      ),
      RUNS,
    )
  })
})
