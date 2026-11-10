import type { AnswerResult } from '../types/api'

/**
 * The five tutorial steps (frontend-08 D14, about 30 seconds in total). The tutorial runs on a scripted,
 * self-contained encounter: no API call, no run, no progress. Choice recorded in docs/kiro-log-frontend.md:
 * a scripted encounter is simpler and more robust than coach-marks over the real first floor, because it
 * works in mock, real and offline mode alike and never depends on generated content.
 */
export type TutorialStepId = 'move' | 'engage' | 'answer' | 'scroll' | 'haunt'

export interface TutorialStep {
  id: TutorialStepId
  title: string
  /** One short instruction, read by a screen reader. */
  text: string
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = Object.freeze([
  { id: 'move', title: 'Move', text: 'Walk toward the monster with the arrow keys or W, A, S, D.' },
  { id: 'engage', title: 'Engage', text: 'You are next to it. Press E or Enter to start the fight.' },
  { id: 'answer', title: 'Answer', text: 'Pick an answer. A right answer lands a blow. A wrong one costs a little courage.' },
  { id: 'scroll', title: 'Memory scroll', text: 'After a miss, a memory scroll shows what your notes say, and you get a second chance.' },
  { id: 'haunt', title: 'Daily Haunt', text: 'Questions you missed come back later as Revenants. Visit the Daily Haunt to lay them to rest.' },
] satisfies readonly TutorialStep[])

/** Cells in the practice corridor. The hero starts on cell 0 and the monster stands on the last one. */
export const CORRIDOR_LENGTH = 5

export interface TutorialQuestion {
  prompt: string
  options: readonly string[]
  correct: string
}

/** A scripted sample question, written like a line from a student's notes. */
export const TUTORIAL_QUESTION: TutorialQuestion = Object.freeze({
  prompt: 'Which part of a cell makes most of its energy?',
  options: ['Mitochondria', 'Nucleus', 'Ribosome'],
  correct: 'Mitochondria',
})

/** The scripted wrong-answer result the sample memory scroll is built from. */
export const TUTORIAL_SCROLL_RESULT: AnswerResult = Object.freeze({
  correct: false,
  damage_dealt: 0,
  monster_hp_remaining: 100,
  player_hp_remaining: 90,
  score_delta: 0,
  streak: 0,
  correct_answer: TUTORIAL_QUESTION.correct,
  explanation: 'The mitochondria turn food into energy the cell can use.',
  evidence_quote: 'The mitochondria make most of the cell\u2019s energy.',
  source: { page: 1, chunk_id: 'tutorial-sample' },
  requeue_after: 3,
})

/** Keys that move the hero one cell toward the monster. */
export const MOVE_KEYS: ReadonlySet<string> = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
])
