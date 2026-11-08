/**
 * Wire layer (D15): zod schemas for the real Backend bodies plus pure mappers to the stable
 * Domain_Model in src/types/api.ts. Only the Http_Client imports this folder.
 */
export * from './attempt'
export * from './auth'
export * from './dungeon'
export * from './kinds'
export * from './progress'
export * from './reviews'
export * from './run'

import { wireAttemptSchema } from './attempt'
import { wireDemoSessionSchema } from './auth'
import { wireDungeonSchema } from './dungeon'
import { wireProgressSchema } from './progress'
import { wireDueReviewsSchema } from './reviews'
import { wireClearSchema, wireFinishSchema, wireRunSchema } from './run'

/** Endpoint label (named in a ContractError) and wire schema, one entry per Http_Client call. */
export const WIRE_ENDPOINTS = {
  startDemoSession: { endpoint: 'POST /demo/session', schema: wireDemoSessionSchema },
  getDungeon: { endpoint: 'GET /dungeons/{id}', schema: wireDungeonSchema },
  startRun: { endpoint: 'POST /runs', schema: wireRunSchema },
  getRun: { endpoint: 'GET /runs/{id}', schema: wireRunSchema },
  submitAttempt: { endpoint: 'POST /runs/{id}/attempts', schema: wireAttemptSchema },
  clearRoom: { endpoint: 'POST /runs/{id}/rooms/{roomId}/clear', schema: wireClearSchema },
  finishRun: { endpoint: 'POST /runs/{id}/finish', schema: wireFinishSchema },
  getProgress: { endpoint: 'GET /progress', schema: wireProgressSchema },
  getDueReviews: { endpoint: 'GET /reviews/due', schema: wireDueReviewsSchema },
} as const
