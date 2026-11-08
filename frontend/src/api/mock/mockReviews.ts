import type { DueReview, Question } from '../../types/api'

/**
 * MOCK-ONLY due-review bookkeeping (the real backend owns spaced repetition).
 * A question is due while the player's latest answer to it was wrong. When seeding is on
 * (VITE_MOCK_SEED_REVENANTS="true") the first questions of each non-boss room are also due, so a
 * demo can show three revenants at once. Seeded reviews clear only when answered correctly.
 */

/** The slice of a Room the store needs. */
export interface ReviewRoom {
  id: string
  order: number
  is_boss: boolean
  question_ids: readonly string[]
}

/** Seeded reviews per non-boss room. */
export const SEED_PER_ROOM = 3

export interface ReviewStore {
  /** Records an answer. The latest answer decides whether the question is due. */
  record(questionId: string, correct: boolean): void
  isDue(questionId: string): boolean
  /** Due question ids in dungeon order (rooms by order, then question order). */
  dueQuestionIds(): string[]
  count(): number
  /** Due reviews as the API returns them (the question never carries the answer). */
  list(questions: readonly Question[]): DueReview[]
}

export function createReviewStore(rooms: readonly ReviewRoom[], seed: boolean): ReviewStore {
  const ordered = [...rooms].sort((a, b) => a.order - b.order)
  const roomOf = new Map<string, string>()
  for (const room of ordered) for (const qid of room.question_ids) roomOf.set(qid, room.id)

  /** Times each question has been answered wrong (kept after it is cleared). */
  const missed = new Map<string, number>()
  /** Questions whose latest answer was wrong. */
  const wrong = new Set<string>()
  const seeded = new Set<string>()
  if (seed) {
    for (const room of ordered) {
      if (room.is_boss) continue
      for (const qid of room.question_ids.slice(0, SEED_PER_ROOM)) seeded.add(qid)
    }
  }

  const isDue = (qid: string): boolean => wrong.has(qid) || seeded.has(qid)
  const dueQuestionIds = (): string[] => {
    const out: string[] = []
    for (const room of ordered) for (const qid of room.question_ids) if (isDue(qid)) out.push(qid)
    return out
  }

  return {
    record(questionId, correct) {
      if (correct) {
        wrong.delete(questionId)
        seeded.delete(questionId)
      } else {
        wrong.add(questionId)
        missed.set(questionId, (missed.get(questionId) ?? 0) + 1)
      }
    },
    isDue,
    dueQuestionIds,
    count: () => dueQuestionIds().length,
    list(questions) {
      const byId = new Map(questions.map((q) => [q.id, q]))
      const out: DueReview[] = []
      for (const qid of dueQuestionIds()) {
        const question = byId.get(qid)
        const room_id = roomOf.get(qid)
        if (!question || !room_id) continue
        const times = missed.get(qid)
        out.push({
          id: `rev-${qid}`,
          question: { ...question, options: [...question.options] },
          room_id,
          ...(times !== undefined ? { times_missed: times } : {}),
        })
      }
      return out
    },
  }
}
