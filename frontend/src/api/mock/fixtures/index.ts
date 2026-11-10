import type { ENDPOINT_SCHEMAS } from '../../schemas'
import attemptCorrect from './attempt.correct.json'
import attemptWrong from './attempt.wrong.json'
import clear from './clear.json'
import demoSession from './demoSession.json'
import dueReviews from './dueReviews.json'
import dungeon from './dungeon.json'
import finish from './finish.json'
import leaderboardDemo from './leaderboard.demo.json'
import me from './me.json'
import progress from './progress.json'
import run from './run.json'
import user from './user.json'
import { floors1 } from './floors.1'
import { floors10 } from './floors.10'
import { floors25 } from './floors.25'
import { floors3 } from './floors.3'

export type EndpointKey = keyof typeof ENDPOINT_SCHEMAS

/** Every fixture with the endpoint whose schema it must satisfy. */
export const FIXTURES: ReadonlyArray<{ name: string; key: EndpointKey; data: unknown }> = [
  { name: 'demoSession', key: 'startDemoSession', data: demoSession },
  { name: 'user', key: 'register', data: user },
  { name: 'user.login', key: 'login', data: user },
  { name: 'me', key: 'getMe', data: me },
  { name: 'dungeon', key: 'getDungeon', data: dungeon },
  { name: 'run', key: 'startRun', data: run },
  { name: 'attempt.correct', key: 'submitAttempt', data: attemptCorrect },
  { name: 'attempt.wrong', key: 'submitAttempt', data: attemptWrong },
  { name: 'clear', key: 'clearRoom', data: clear },
  { name: 'finish', key: 'finishRun', data: finish },
  { name: 'progress', key: 'getProgress', data: progress },
  { name: 'dueReviews', key: 'getDueReviews', data: dueReviews },
  { name: 'leaderboard.demo', key: 'getLeaderboard', data: leaderboardDemo },
  { name: 'floors.1', key: 'getDungeon', data: floors1.dungeon },
  { name: 'floors.3', key: 'getDungeon', data: floors3.dungeon },
  { name: 'floors.10', key: 'getDungeon', data: floors10.dungeon },
  { name: 'floors.25', key: 'getDungeon', data: floors25.dungeon },
]

export const fixtures = {
  demoSession,
  user,
  me,
  dungeon,
  run,
  attemptCorrect,
  attemptWrong,
  clear,
  finish,
  progress,
  dueReviews,
  leaderboardDemo,
}

/** Floor fixtures by floor count (tests and the DEV route only). */
export const floorFixtures = { 1: floors1, 3: floors3, 10: floors10, 25: floors25 } as const
