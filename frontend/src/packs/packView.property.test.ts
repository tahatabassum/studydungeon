import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { currentPack, unlockedBetween } from './packView'
import type { Pack, PackStatus } from '../types/api'

const STATUSES: readonly PackStatus[] = ['locked', 'available', 'in_progress', 'completed']

const mk = (order: number, status: PackStatus): Pack => ({
  id: `pack-${order}`,
  order,
  title: `Pack ${order}`,
  description: '',
  dungeon_id: `dun-${order}`,
  floors_total: 2,
  floors_cleared: 0,
  final_boss_cleared: status === 'completed',
  status,
  points_earned: 0,
})

const statusArb = fc.constantFrom(...STATUSES)

/** Two lists over the same ids, with random statuses and a shuffled order of presentation. */
const pairArb = fc
  .integer({ min: 0, max: 6 })
  .chain((n) =>
    fc.record({
      before: fc.array(statusArb, { minLength: n, maxLength: n }),
      after: fc.array(statusArb, { minLength: n, maxLength: n }),
      shuffle: fc.infiniteStream(fc.nat()),
    }),
  )

// Feature: frontend-10-live-players, Property 5: Pack view reports exactly the newly unlocked packs
// **Validates: Requirements 8.2, 9.5**
describe('Property 5: Pack view reports exactly the newly unlocked packs', () => {
  it('unlockedBetween returns the locked -> available packs in pack order, and nothing for identical lists', () => {
    fc.assert(
      fc.property(pairArb, ({ before, after }) => {
        const b = before.map((s, i) => mk(i + 1, s))
        const a = after.map((s, i) => mk(i + 1, s))
        const expected = a.filter((p, i) => before[i] === 'locked' && p.status === 'available').map((p) => p.id)
        // Present the "after" list reversed: the result must still be in pack order.
        const got = unlockedBetween(b, [...a].reverse()).map((p) => p.id)
        expect(got).toEqual(expected)
        expect(unlockedBetween(b, b)).toEqual([])
        expect(unlockedBetween(a, a)).toEqual([])
      }),
      { numRuns: 100 },
    )
  })

  it('currentPack never returns a locked or completed pack unless every pack is completed', () => {
    fc.assert(
      fc.property(
        fc.array(statusArb, { maxLength: 6 }),
        fc.option(fc.nat({ max: 7 }), { nil: null }),
        (statuses, nextIdx) => {
          const packs = statuses.map((s, i) => mk(i + 1, s))
          const res = currentPack({ packs, next_pack_id: nextIdx === null ? null : `pack-${nextIdx}` })
          const allDone = packs.length > 0 && packs.every((p) => p.status === 'completed')
          if (res === null) {
            expect(packs.length === 0 || !packs.some((p) => p.status === 'available' || p.status === 'in_progress')).toBe(true)
            expect(allDone).toBe(false)
          } else if (allDone) {
            expect(res.order).toBe(1)
          } else {
            expect(res.status === 'available' || res.status === 'in_progress').toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
