import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { applyPackClear, initialStatuses, type PackDef } from './mockPacks'

const defsOf = (n: number): PackDef[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `pack-${i + 1}`,
    order: i + 1,
    title: `Pack ${i + 1}`,
    description: '',
    dungeonId: `dun-${i + 1}`,
    sample: i > 0,
  }))

// Feature: frontend-10-live-players, Property 6: Mock pack unlock follows the final boss
// **Validates: Requirements 8.7**
describe('Property 6: Mock pack unlock follows the final boss', () => {
  it('a clear completes its pack, unlocks only a locked next pack, touches nothing else and is idempotent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }).chain((n) => fc.tuple(fc.constant(n), fc.array(fc.integer({ min: 0, max: n - 1 }), { maxLength: 12 }))),
        ([n, clears]) => {
          const defs = defsOf(n)
          let statuses = initialStatuses(defs)
          expect([...statuses.values()]).toEqual(defs.map((_, i) => (i === 0 ? 'available' : 'locked')))
          for (const idx of clears) {
            const id = defs[idx].id
            const before = new Map(statuses)
            const { statuses: after, progress } = applyPackClear(defs, statuses, id)
            expect(after.get(id)).toBe('completed')
            const next = defs[idx + 1]
            for (const d of defs) {
              if (d.id === id) continue
              if (next && d.id === next.id && before.get(d.id) === 'locked') expect(after.get(d.id)).toBe('available')
              else expect(after.get(d.id)).toBe(before.get(d.id))
            }
            const expectedUnlock = before.get(id) !== 'completed' && next && before.get(next.id) === 'locked' ? next.id : null
            expect(progress.unlocked_pack_id).toBe(expectedUnlock)
            // Applying the same clear twice changes nothing.
            const twice = applyPackClear(defs, after, id)
            expect([...twice.statuses.entries()]).toEqual([...after.entries()])
            expect(twice.progress.unlocked_pack_id).toBeNull()
            expect(progress.all_completed).toBe(defs.every((d) => after.get(d.id) === 'completed'))
            statuses = after
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
