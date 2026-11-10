/**
 * The mock supplies the PROPOSED progress fields (notes conquered, memory strength, a 12-week calendar,
 * weakest concepts) and they validate against the progress schema.
 * **Validates: Requirements 10.3, 10.4**
 */
import { describe, expect, it } from 'vitest'
import { progressSchema } from '../schemas'
import { createMockAdapter } from './mockAdapter'
import { CALENDAR_DAYS, buildStreakCalendar, notesConqueredPercent } from './mockProgress'

describe('streak calendar builder', () => {
  const now = Date.UTC(2025, 5, 15, 12)
  it('covers 84 days ending today, oldest first', () => {
    const days = buildStreakCalendar(now, 0, false)
    expect(days).toHaveLength(CALENDAR_DAYS)
    expect(days[CALENDAR_DAYS - 1].date).toBe('2025-06-15')
    expect(days[0].date < days[1].date).toBe(true)
    expect(days.some((d) => d.reviewed)).toBe(false)
  })
  it('marks the Daily Haunt streak back from today, or from yesterday before today is done', () => {
    const done = buildStreakCalendar(now, 3, true).filter((d) => d.reviewed).map((d) => d.date)
    expect(done).toEqual(['2025-06-13', '2025-06-14', '2025-06-15'])
    const pending = buildStreakCalendar(now, 2, false).filter((d) => d.reviewed).map((d) => d.date)
    expect(pending).toEqual(['2025-06-13', '2025-06-14'])
  })
  it('computes a bounded percent', () => {
    expect(notesConqueredPercent(1, 4)).toBe(25)
    expect(notesConqueredPercent(9, 4)).toBe(100)
    expect(notesConqueredPercent(0, 0)).toBe(0)
  })
})

describe('mock getProgress', () => {
  it('carries the proposed learning fields and validates', async () => {
    const api = createMockAdapter()
    const p = await api.getProgress()
    expect(progressSchema.safeParse(p).success).toBe(true)
    expect(p.notes_conquered_percent).toBe(0)
    expect(p.streak_calendar).toHaveLength(CALENDAR_DAYS)
    expect(p.memory_strength).toEqual([])
    expect(p.weak_concepts).toEqual([])
  })

  it('shows memory strength and weak concepts after a wrong answer', async () => {
    const api = createMockAdapter()
    const dungeon = await api.getDungeon('demo-dungeon')
    const run = await api.startRun({ dungeon_id: 'demo-dungeon', floor_id: 'floor-1', mode: 'floor' })
    const q = dungeon.rooms.find((r) => r.id === run.current_room_id)!.monster.question_ids[0]
    await api.submitAttempt(run.id, { question_id: q, selected_answer: '__wrong__', attempt_id: 'a1' })
    const p = await api.getProgress()
    expect(p.memory_strength?.length).toBe(1)
    expect(p.memory_strength?.[0].strength).toBeLessThan(50)
    expect(p.weak_concepts).toHaveLength(1)
    expect(typeof p.weak_concepts?.[0].page).toBe('number')
  })
})
