import type { ENDPOINT_SCHEMAS } from '../../schemas'
import attemptCorrect from './attempt.correct.json'
import attemptWrong from './attempt.wrong.json'
import clear from './clear.json'
import demoSession from './demoSession.json'
import dueReviews from './dueReviews.json'
import dungeon from './dungeon.json'
import finish from './finish.json'
import progress from './progress.json'
import run from './run.json'

export type EndpointKey = keyof typeof ENDPOINT_SCHEMAS

/** Every fixture with the endpoint whose schema it must satisfy. */
export const FIXTURES: ReadonlyArray<{ name: string; key: EndpointKey; data: unknown }> = [
  { name: 'demoSession', key: 'startDemoSession', data: demoSession },
  { name: 'dungeon', key: 'getDungeon', data: dungeon },
  { name: 'run', key: 'startRun', data: run },
  { name: 'attempt.correct', key: 'submitAttempt', data: attemptCorrect },
  { name: 'attempt.wrong', key: 'submitAttempt', data: attemptWrong },
  { name: 'clear', key: 'clearRoom', data: clear },
  { name: 'finish', key: 'finishRun', data: finish },
  { name: 'progress', key: 'getProgress', data: progress },
  { name: 'dueReviews', key: 'getDueReviews', data: dueReviews },
]

export const fixtures = { demoSession, dungeon, run, attemptCorrect, attemptWrong, clear, finish, progress, dueReviews }
