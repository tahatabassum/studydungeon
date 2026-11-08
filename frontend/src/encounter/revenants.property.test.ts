import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { DueReview } from '@/types/api'
import { MAX_REVENANTS_PER_ROOM, remainingDue, spawnCount, spawnsForRoom } from './revenants'

const review = (id: number, room: string): DueReview => ({
  id: `rev-${id}`,
  room_id: room,
  question: { id: `q${id}`, type: 'mcq', prompt: 'p', options: ['a', 'b'] },
})

describe('revenant counting', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 10: Revenant spawn count and counter
  // **Validates: Requirements 9.1, 9.4, 9.5, 9.6**
  it('Property 10: spawns the smaller of 3 and the list length, and the counter never goes below 0', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('room-1', 'room-2', 'room-3'), { maxLength: 12 }),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (rooms, n, r) => {
          const list = rooms.map((room, i) => review(i, room))
          expect(spawnCount(list)).toBe(Math.min(3, list.length))
          expect(spawnCount([])).toBe(0)
          for (const room of new Set(rooms)) {
            const inRoom = list.filter((d) => d.room_id === room)
            const spawns = spawnsForRoom(list, room)
            expect(spawns).toHaveLength(spawnCount(inRoom))
            expect(spawns.length).toBeLessThanOrEqual(MAX_REVENANTS_PER_ROOM)
            expect(spawns.map((s) => s.id)).toEqual(inRoom.slice(0, spawns.length).map((d) => d.id))
          }
          expect(remainingDue(n, r)).toBe(Math.max(0, n - r))
          expect(remainingDue(n, 0)).toBe(n)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('shows 0 and spawns nothing for an empty list', () => {
    expect(spawnsForRoom([], 'room-1')).toEqual([])
    expect(remainingDue(0, 0)).toBe(0)
    expect(remainingDue(2, 5)).toBe(0)
  })
})
