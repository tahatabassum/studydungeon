import { z } from 'zod'
import type { Dungeon, Question, Room } from '../../types/api'
import { kindFromMonsterType, questionTypeFromOptions } from './kinds'

/** `GET /dungeons/{id}` (DungeonDetailView). Answers, explanations and quotes are never in it. */
export const wireQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  difficulty: z.string(),
})

export const wireRoomSchema = z.object({
  id: z.string().min(1),
  room_number: z.number().int(),
  topic_name: z.string(),
  monster_name: z.string(),
  monster_type: z.string(),
  monster_hp: z.number().int().positive(),
  is_boss: z.boolean(),
  questions: z.array(wireQuestionSchema),
})

export const wireDungeonSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  is_public_demo: z.boolean().optional(),
  created_at: z.string().optional(),
  rooms: z.array(wireRoomSchema).min(1),
})

export type WireDungeon = z.output<typeof wireDungeonSchema>

/** C2 to C6: title to name, room questions flattened, monster built from the flat room fields. */
export function mapDungeon(w: WireDungeon): Dungeon {
  const questions: Question[] = []
  const seen = new Set<string>()
  const rooms: Room[] = [...w.rooms]
    .sort((a, b) => a.room_number - b.room_number)
    .map((r) => {
      for (const q of r.questions) {
        if (seen.has(q.id)) continue
        seen.add(q.id)
        questions.push({
          id: q.id,
          type: questionTypeFromOptions(q.options),
          prompt: q.prompt,
          options: q.options,
          difficulty: q.difficulty,
        })
      }
      return {
        id: r.id,
        label: r.topic_name,
        order: r.room_number,
        is_boss: r.is_boss,
        monster: {
          id: `monster-${r.id}`,
          name: r.monster_name,
          kind: kindFromMonsterType(r.monster_type, r.is_boss),
          // Never hard-coded: whatever the backend sends (80, 90, 85, 220, ...).
          max_hp: r.monster_hp,
          question_ids: r.questions.map((q) => q.id),
        },
      }
    })
  return { id: w.id, name: w.title, rooms, questions }
}
