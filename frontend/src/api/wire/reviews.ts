import { z } from 'zod'
import type { DueReview, DueReviewsResponse } from '../../types/api'
import { questionTypeFromOptions } from './kinds'

/** `GET /reviews/due`: a bare array across all dungeons (C20). */
export const wireDueItemSchema = z.object({
  question_id: z.string().min(1),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  next_review_at: z.string().optional(),
  repetition_count: z.number().int().nonnegative().optional(),
})

export const wireDueReviewsSchema = z.array(wireDueItemSchema)

/**
 * id = question_id; the question is rebuilt from the item. `room_id` is looked up in the loaded
 * dungeon; a question from another dungeon gets '' (it never matches a room, but still counts).
 */
export function mapDueReviews(
  items: z.output<typeof wireDueReviewsSchema>,
  roomOfQuestion: (questionId: string) => string | undefined,
): DueReview[] {
  const seen = new Set<string>()
  const out: DueReview[] = []
  for (const it of items) {
    if (seen.has(it.question_id)) continue
    seen.add(it.question_id)
    out.push({
      id: it.question_id,
      question: {
        id: it.question_id,
        type: questionTypeFromOptions(it.options),
        prompt: it.prompt,
        options: it.options,
      },
      room_id: roomOfQuestion(it.question_id) ?? '',
    })
  }
  return out
}

/** Today's backend sends a bare array: wrap it in the new shape. Streak and next due time are unknown. */
export function mapDueSummary(items: DueReview[]): DueReviewsResponse {
  return { due_count: items.length, next_due_at: null, daily_streak: 0, items }
}
