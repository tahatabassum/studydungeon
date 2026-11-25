/**
 * Question_Selector: pure helper that picks the next question id for a monster.
 *
 * Selection cycles through the pool in order: `pool[askedCount % pool.length]`.
 * `askedCount` is floored; negative, NaN or non-finite values are treated as 0.
 * Returns `undefined` for an empty pool.
 */
export function pickQuestionId(
  pool: readonly string[],
  askedCount: number,
): string | undefined {
  if (pool.length === 0) return undefined
  const n = Number.isFinite(askedCount) ? Math.floor(askedCount) : 0
  const index = (n > 0 ? n : 0) % pool.length
  return pool[index]
}

/** Input for {@link selectNextQuestion}. All sets hold question ids. */
export interface SelectInput {
  /** monster.question_ids, in rotation order */
  monsterPool: readonly string[]
  /** All question ids of the same topic in the dungeon */
  topicPool: readonly string[]
  /** Answered in this Encounter */
  answered: ReadonlySet<string>
  /** Answered wrongly anywhere in this Run */
  missed: ReadonlySet<string>
  /** Answered correctly anywhere in this Run */
  correct: ReadonlySet<string>
  /**
   * Ids in the order they were asked in this Run, oldest first (repeats allowed). The recycled step
   * picks the id asked least recently, so a monster with only recycled questions rotates through them.
   */
  recentlyAsked?: readonly string[]
}

export type Selection =
  | { kind: 'fresh' | 'topic' | 'recycled'; id: string }
  | { kind: 'none' }

/**
 * Pure selector for the next question. Order: first unanswered, non-missed id
 * in the monster pool (fresh); then an unused, non-missed id in the topic pool
 * (topic); then a correctly answered, non-missed id (recycled); else none.
 * A missed id is never returned.
 */
export function selectNextQuestion(i: SelectInput): Selection {
  const used = (id: string): boolean => i.answered.has(id) || i.missed.has(id)

  const fresh = i.monsterPool.find((id) => !used(id))
  if (fresh !== undefined) return { kind: 'fresh', id: fresh }

  const topic = i.topicPool.find((id) => !used(id) && !i.correct.has(id))
  if (topic !== undefined) return { kind: 'topic', id: topic }

  const candidates = [...new Set([...i.monsterPool, ...i.topicPool])].filter(
    (id) => i.correct.has(id) && !i.missed.has(id),
  )
  if (candidates.length > 0) {
    // Least recently asked first (never asked = -1); ties keep pool order.
    const recent = i.recentlyAsked ?? []
    let best = candidates[0]
    let bestAt = recent.lastIndexOf(best)
    for (const id of candidates.slice(1)) {
      const at = recent.lastIndexOf(id)
      if (at < bestAt) {
        best = id
        bestAt = at
      }
    }
    return { kind: 'recycled', id: best }
  }

  return { kind: 'none' }
}
