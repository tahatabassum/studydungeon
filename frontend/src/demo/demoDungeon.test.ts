import { describe, expect, it } from 'vitest'
import dungeonJson from './demoDungeon.json'
import { answerKey } from '@/api/mock/answerKey'

interface DemoRoom {
  id: string
  label: string
  order: number
  is_boss: boolean
  monster: { id: string; name: string; kind: string; max_hp: number; question_ids: string[] }
}
interface DemoDungeon {
  rooms: DemoRoom[]
  questions: { id: string; options: string[] }[]
}

const dungeon = dungeonJson as unknown as DemoDungeon

// Boss pool topics, keyed by question id (two per topic).
const BOSS_TOPICS: Record<string, string[]> = {
  basics: ['b1', 'b2'],
  memory: ['b3', 'b4'],
  networking: ['b5', 'b6'],
  algorithms: ['b7', 'b8'],
}

describe('demo dungeon', () => {
  const rooms = dungeon.rooms

  it('has five rooms with expected labels, monsters and HP', () => {
    expect(rooms.map((r) => r.label)).toEqual([
      'Entry Hall',
      "Alchemist's Lab",
      'Clockwork Crypt',
      'Forgotten Wing',
      'Boss Room',
    ])
    expect(rooms.map((r) => [r.monster.name, r.monster.kind])).toEqual([
      ['Paper Wraith', 'paper_wraith'],
      ['Toxic Slime', 'toxic_slime'],
      ['Gear Golem', 'gear_golem'],
      ['Memory Eater', 'memory_eater'],
      ['The Exam Warden', 'exam_warden'],
    ])
    expect(rooms.map((r) => r.monster.max_hp)).toEqual([60, 60, 60, 60, 120])
    expect(rooms.map((r) => r.order)).toEqual([1, 2, 3, 4, 5])
    expect(rooms[0].id).toBe('room-1')
    expect(rooms[0].monster.id).toBe('monster-1')
  })

  it('has exactly one boss and it is last', () => {
    expect(rooms.filter((r) => r.is_boss)).toHaveLength(1)
    expect(rooms[rooms.length - 1].is_boss).toBe(true)
  })

  it('has 3 to 5 questions per topic room', () => {
    for (const r of rooms.filter((x) => !x.is_boss)) {
      expect(r.monster.question_ids.length).toBeGreaterThanOrEqual(3)
      expect(r.monster.question_ids.length).toBeLessThanOrEqual(5)
    }
  })

  it('references every question from exactly one pool, with unique ids', () => {
    const ids = dungeon.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    const referenced = rooms.flatMap((r) => r.monster.question_ids)
    expect(new Set(referenced).size).toBe(referenced.length)
    expect([...referenced].sort()).toEqual([...ids].sort())
  })

  it('has an answer key entry for every question, correct among options', () => {
    for (const q of dungeon.questions) {
      const entry = answerKey[q.id]
      expect(entry, q.id).toBeDefined()
      expect(q.options).toContain(entry.correct)
      expect(entry.page).toBeGreaterThan(0)
      expect(entry.chunk_id.length).toBeGreaterThan(0)
    }
    expect(Object.keys(answerKey).sort()).toEqual(
      dungeon.questions.map((q) => q.id).sort(),
    )
  })

  it('boss pool has eight questions, two per topic', () => {
    const pool = rooms[4].monster.question_ids
    expect(pool).toHaveLength(8)
    for (const ids of Object.values(BOSS_TOPICS)) {
      expect(ids.filter((id) => pool.includes(id))).toHaveLength(2)
    }
  })

  it('contains no answer key fields in the public JSON', () => {
    const text = JSON.stringify(dungeonJson)
    for (const key of ['"correct"', '"explanation"', '"chunk_id"']) {
      expect(text).not.toContain(key)
    }
  })
})
