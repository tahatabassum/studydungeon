/**
 * MOCK-ONLY requeue (D5). A missed question returns after REQUEUE_GAP further questions (or at the end
 * of the queue when fewer remain), at most MAX_RETURNS times per question. Real mode uses the
 * Backend's `requeue_after`. Pure: every function returns a new state.
 */

export const REQUEUE_GAP = 3
export const MAX_RETURNS = 2

export interface RequeueState {
  /** Ids still to present, front first. */
  queue: readonly string[]
  /** Times each id has been put back. */
  returns: Readonly<Record<string, number>>
}

export function buildQueue(drawn: readonly string[]): RequeueState {
  return { queue: [...drawn], returns: {} }
}

export interface AnswerOutcome {
  state: RequeueState
  /** Further questions before this one returns, or null when it does not return. */
  requeueAfter: number | null
}

/**
 * Applies the answer for the question at the front of the queue. A wrong answer re-inserts it after
 * `REQUEUE_GAP` further questions (clamped to the end) while it has returns left.
 */
export function onAnswer(state: RequeueState, id: string, correct: boolean): AnswerOutcome {
  const rest = state.queue[0] === id ? state.queue.slice(1) : state.queue.filter((q) => q !== id)
  const used = state.returns[id] ?? 0
  if (correct || used >= MAX_RETURNS) {
    return { state: { queue: rest, returns: state.returns }, requeueAfter: null }
  }
  const gap = Math.min(REQUEUE_GAP, rest.length)
  const queue = [...rest.slice(0, gap), id, ...rest.slice(gap)]
  return {
    state: { queue, returns: { ...state.returns, [id]: used + 1 } },
    requeueAfter: gap,
  }
}

/** Replays a full session: returns the order in which questions were presented. */
export function presentedOrder(drawn: readonly string[], answers: (id: string, presentation: number) => boolean): string[] {
  let state = buildQueue(drawn)
  const out: string[] = []
  let guard = 0
  while (state.queue.length > 0 && guard < 10_000) {
    guard += 1
    const id = state.queue[0]
    out.push(id)
    state = onAnswer(state, id, answers(id, out.length - 1)).state
  }
  return out
}
