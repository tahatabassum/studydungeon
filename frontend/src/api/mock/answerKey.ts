/**
 * Private answer table for the Mock_Adapter. Never part of the public
 * Dungeon/Question shape. Placeholder content only.
 */
export interface AnswerKeyEntry {
  correct: string
  explanation?: string
  page: number
  chunk_id: string
}

export const answerKey: Readonly<Record<string, AnswerKeyEntry>> = {
  q1: {
    correct: 'CPU',
    explanation: 'The CPU fetches, decodes and executes instructions.',
    page: 3,
    chunk_id: 'chunk-cpu',
  },
  q2: {
    correct: 'RAM',
    explanation: 'RAM is volatile working memory.',
    page: 5,
    chunk_id: 'chunk-ram',
  },
  q3: {
    correct: 'Arithmetic and logic operations',
    page: 4,
    chunk_id: 'chunk-alu',
  },
  q4: {
    correct: 'Binary',
    explanation: 'Digital circuits represent data with two states, 0 and 1.',
    page: 7,
    chunk_id: 'chunk-binary',
  },
  q5: {
    correct: 'True',
    explanation: 'The OS schedules processes and manages memory and devices.',
    page: 9,
    chunk_id: 'chunk-os',
  },
}
