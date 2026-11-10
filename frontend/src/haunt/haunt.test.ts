import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { DueReview, Floor } from '@/types/api'
import { HALL_CAPACITY, buildHall, hallCount, hallRoomAtRest, remainingSpawns } from './hauntHall'
import { MILESTONE_TEXT, formatClock, milestoneCrossed, remainingSeconds } from './examClock'
import { EXAM_MINUTES, hauntPath, isPracticeMode, modePath, modeRequest, parseExamMinutes, replayableFloors } from './modes'
import { nextDuePhrase, nextDueText } from './nextDue'

const item = (n: number): DueReview => ({
  id: `rev-q${n}`,
  question: { id: `q${n}`, type: 'mcq', prompt: `Prompt ${n}`, options: ['a', 'b'] },
  room_id: `room-${(n % 4) + 1}`,
})
const items = (count: number): DueReview[] => Array.from({ length: count }, (_, i) => item(i + 1))

describe('Haunted Hall', () => {
  it('builds nothing from nothing', () => {
    expect(buildHall('d', [])).toBeNull()
  })

  it('shows every item received as one ghost, at most 3 per hall, in order', () => {
    const hall = buildHall('d', items(8))!
    expect(hall.total).toBe(8)
    expect(hall.roomIds).toEqual(['hall-1', 'hall-2', 'hall-3'])
    expect(hall.roomIds.map((id) => hall.spawnsByRoom[id].length)).toEqual([3, 3, 2])
    expect(hall.roomIds.flatMap((id) => hall.spawnsByRoom[id].map((s) => s.questionId))).toEqual(
      items(8).map((i) => i.question.id),
    )
    // Display-only rooms: a 0 HP monster of the revenant kind, never a boss.
    expect(hall.dungeon.rooms.every((r) => r.monster.max_hp === 0 && !r.is_boss && r.monster.kind === 'revenant')).toBe(true)
    expect(hall.dungeon.rooms.map((r) => r.order)).toEqual([1, 2, 3])
    // The item points at its hall, not at the room it came from.
    expect(hall.reviews.map((r) => r.room_id)).toEqual(['hall-1', 'hall-1', 'hall-1', 'hall-2', 'hall-2', 'hall-2', 'hall-3', 'hall-3'])
  })

  it('does not trim a longer list from the Backend', () => {
    expect(buildHall('d', items(13))!.total).toBe(13)
    expect(hallCount(13)).toBe(5)
  })

  it('a hall is at rest when all its ghosts are laid to rest', () => {
    const hall = buildHall('d', items(4))!
    expect(hallRoomAtRest(hall, 'hall-1', new Set())).toBe(false)
    expect(hallRoomAtRest(hall, 'hall-1', new Set(['rev-q1', 'rev-q2']))).toBe(false)
    expect(hallRoomAtRest(hall, 'hall-1', new Set(['rev-q1', 'rev-q2', 'rev-q3']))).toBe(true)
    expect(remainingSpawns(hall, 'hall-1', new Set(['rev-q2'])).map((s) => s.id)).toEqual(['rev-q1', 'rev-q3'])
    expect(hallRoomAtRest(hall, 'hall-9', new Set())).toBe(false)
  })

  // Feature: frontend-08-campaign-learning-loop, Property 9: Daily Haunt contains only due items and handles empty
  // **Validates: Requirements 7.1, 7.5**
  it('Property 9 (hall): the ghosts are exactly the items received, unique, at most 3 per hall', () => {
    const ids = fc.uniqueArray(fc.integer({ min: 1, max: 60 }), { maxLength: 30 })
    fc.assert(
      fc.property(ids, fc.integer({ min: 0, max: 3 }), (list, dupes) => {
        const base = list.map(item)
        const received = [...base, ...base.slice(0, dupes)]
        const hall = buildHall('d', received)
        if (base.length === 0) {
          expect(hall).toBeNull()
          return
        }
        expect(hall).not.toBeNull()
        const ghosts = hall!.roomIds.flatMap((id) => hall!.spawnsByRoom[id].map((s) => s.id))
        expect(ghosts).toEqual(base.map((b) => b.id))
        for (const id of hall!.roomIds) expect(hall!.spawnsByRoom[id].length).toBeLessThanOrEqual(HALL_CAPACITY)
        expect(hall!.roomIds).toHaveLength(hallCount(base.length))
      }),
      { numRuns: 100 },
    )
  })
})

describe('next due text', () => {
  const NOW = Date.parse('2026-03-01T10:00:00Z')
  const at = (ms: number) => new Date(NOW + ms).toISOString()
  it('words the wait as hours, minutes or days', () => {
    expect(nextDueText(at(3 * 3_600_000), NOW)).toBe('Next memory stirs in 3 h')
    expect(nextDueText(at(25 * 60_000), NOW)).toBe('Next memory stirs in 25 min')
    expect(nextDueText(at(30_000), NOW)).toBe('Next memory stirs in under a minute')
    expect(nextDueText(at(72 * 3_600_000), NOW)).toBe('Next memory stirs in 3 days')
    expect(nextDuePhrase('not a date', NOW)).toBeNull()
  })
  it('says honestly when nothing is scheduled', () => {
    expect(nextDueText(null, NOW)).toMatch(/No memory is scheduled/)
    expect(nextDueText('garbage', NOW)).toMatch(/No memory is scheduled/)
  })
})

describe('mode requests', () => {
  it('maps each mode to its startRun body', () => {
    expect(modeRequest('weak_topics', 'd')).toEqual({ dungeon_id: 'd', floor_id: null, mode: 'weak_topics' })
    expect(modeRequest('exam', 'd')).toEqual({ dungeon_id: 'd', floor_id: null, mode: 'exam' })
    expect(modeRequest('replay_floor', 'd', 'floor-1')).toEqual({ dungeon_id: 'd', floor_id: 'floor-1', mode: 'replay_floor' })
    expect(modeRequest('daily_haunt', 'd')).toEqual({ dungeon_id: 'd', floor_id: null, mode: 'daily_haunt' })
    expect(() => modeRequest('replay_floor', 'd')).toThrow()
  })
  it('builds and reads routes; the exam timer is off unless a valid length is given', () => {
    expect(modePath('d', 'weak_topics')).toBe('/campaign/d/mode/weak_topics')
    expect(modePath('d', 'exam')).toBe('/campaign/d/mode/exam')
    expect(modePath('d', 'exam', { minutes: 20 })).toBe('/campaign/d/mode/exam?minutes=20')
    expect(modePath('d', 'replay_floor', { floorId: 'floor-1' })).toBe('/campaign/d/mode/replay_floor/floor-1')
    expect(hauntPath('a b')).toBe('/haunt/a%20b')
    expect(parseExamMinutes('')).toBeNull()
    expect(parseExamMinutes('?minutes=20')).toBe(20)
    expect(parseExamMinutes('?minutes=7')).toBeNull()
    expect(parseExamMinutes('?minutes=abc')).toBeNull()
    expect(EXAM_MINUTES).toEqual([10, 20, 30])
    expect(isPracticeMode('exam')).toBe(true)
    expect(isPracticeMode('daily_haunt')).toBe(false)
  })
  it('replay lists only cleared floors', () => {
    const floor = (id: string, status: Floor['status']): Floor => ({
      id,
      index: 1,
      title: id,
      status,
      topics: [],
      boss: { id: 'b', name: 'B', hp: 1 },
      rank: null,
      room_ids: [],
    })
    const list = [floor('a', 'cleared'), floor('b', 'ready'), floor('c', 'locked'), floor('d', 'cleared'), floor('e', 'failed')]
    expect(replayableFloors(list).map((f) => f.id)).toEqual(['a', 'd'])
  })
})

describe('exam clock', () => {
  it('formats and counts down without going below zero', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(605)).toBe('10:05')
    expect(remainingSeconds(10_000, 4_500)).toBe(6)
    expect(remainingSeconds(10_000, 20_000)).toBe(0)
  })
  it('announces only at 5 minutes and 1 minute', () => {
    expect(milestoneCrossed(301, 300)).toBe('five')
    expect(milestoneCrossed(300, 299)).toBeNull()
    expect(milestoneCrossed(61, 60)).toBe('one')
    expect(milestoneCrossed(400, 50)).toBe('one')
    expect(milestoneCrossed(120, 119)).toBeNull()
    expect(MILESTONE_TEXT.five).toMatch(/5 minutes/)
    expect(MILESTONE_TEXT.one).toMatch(/1 minute/)
  })
})
