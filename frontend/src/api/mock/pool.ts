import type { Question } from '../../types/api'

/**
 * MOCK-ONLY question pools (D4). The demo keeps its authored questions (no invented content);
 * dev fixtures synthesize 15 to 20 clearly labeled "Sample question" items per topic.
 */

export const MIN_POOL = 15
export const MAX_POOL = 20

/** Pool size for a topic, between 15 and 20, stable for the same key. */
export function poolSizeFor(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return MIN_POOL + (h % (MAX_POOL - MIN_POOL + 1))
}

/** A synthetic pool for one topic. Ids are `<topicId>-q<n>`; the prompt says it is a sample. */
export function syntheticPool(topicId: string, topicTitle: string, size = poolSizeFor(topicId)): Question[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `${topicId}-q${i + 1}`,
    type: 'mcq' as const,
    prompt: `Sample question ${i + 1} about ${topicTitle}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
  }))
}

/** The pool of a topic from authored questions (the demo): the question ids a monster owns. */
export function authoredPool(questions: readonly Question[], questionIds: readonly string[]): Question[] {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return questionIds.flatMap((id) => {
    const q = byId.get(id)
    return q ? [q] : []
  })
}
