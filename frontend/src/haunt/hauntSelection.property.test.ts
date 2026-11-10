import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { selectDailyHaunt } from './hauntSelection'

const NOW = Date.parse('2026-01-15T12:00:00Z')

const itemsArb = fc.array(
  fc.record({
    id: fc.uuid(),
    at: fc.integer({ min: -3 * 86_400_000, max: 3 * 86_400_000 }),
  }),
  { maxLength: 30 },
)

describe('Daily Haunt selection', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 9: Daily Haunt contains only due items and handles empty
  // **Validates: Requirements 3.9, 7.5, 7.6**
  it('Property 9: only due items, ordered by due time, capped; empty keeps the next due time', () => {
    fc.assert(
      fc.property(itemsArb, fc.integer({ min: 0, max: 12 }), (raw, cap) => {
        const items = raw.map((r) => ({ id: r.id, due_at: new Date(NOW + r.at).toISOString() }))
        const { selected, next_due_at } = selectDailyHaunt(items, NOW, cap)
        expect(selected.length).toBeLessThanOrEqual(cap)
        let prev = -Infinity
        for (const s of selected) {
          const t = Date.parse(s.due_at)
          expect(t).toBeLessThanOrEqual(NOW)
          expect(t).toBeGreaterThanOrEqual(prev)
          prev = t
        }
        const dueCount = items.filter((i) => Date.parse(i.due_at) <= NOW).length
        expect(selected.length).toBe(Math.min(cap, dueCount))
        const future = items.map((i) => Date.parse(i.due_at)).filter((t) => t > NOW)
        if (future.length === 0) expect(next_due_at).toBeNull()
        else expect(Date.parse(next_due_at!)).toBe(Math.min(...future))
      }),
      { numRuns: 100 },
    )
  })

  it('handles an empty list and an all-future list', () => {
    expect(selectDailyHaunt([], NOW)).toEqual({ selected: [], next_due_at: null })
    const later = new Date(NOW + 3_600_000).toISOString()
    expect(selectDailyHaunt([{ id: 'a', due_at: later }], NOW)).toEqual({ selected: [], next_due_at: later })
  })
})
