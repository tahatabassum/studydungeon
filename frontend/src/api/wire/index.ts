/**
 * Wire layer (D15): zod schemas for the real Backend bodies plus pure mappers to the stable
 * Domain_Model in src/types/api.ts. Only the Http_Client imports this folder.
 */
export * from './attempt'
export * from './board'
export * from './auth'
export * from './documents'
export * from './dungeon'
export * from './kinds'
export * from './packs'
export * from './progress'
export * from './reviews'
export * from './run'

import { wireAttemptSchema } from './attempt'
import {
  wireCreateGuestSchema,
  wireDeleteAccountSchema,
  wireDemoSessionSchema,
  wireDungeonListSchema,
  wireLogoutSchema,
  wireNameCheckSchema,
  wireUpgradeSchema,
  wireUserSchema,
} from './auth'
import { wireBoardSchema } from './board'
import { wireDocumentStatusSchema, wireDocumentTopicsSchema, wireDocumentUploadSchema } from './documents'
import { wireDungeonSchema } from './dungeon'
import { wirePacksSchema } from './packs'
import { wireProgressSchema } from './progress'
import { wireDueReviewsSchema } from './reviews'
import { wireClearSchema, wireFinishSchema, wireRunSchema } from './run'

/** Endpoint label (named in a ContractError) and wire schema, one entry per Http_Client call. */
export const WIRE_ENDPOINTS = {
  startDemoSession: { endpoint: 'POST /demo/session', schema: wireDemoSessionSchema },
  register: { endpoint: 'POST /auth/register', schema: wireUserSchema },
  login: { endpoint: 'POST /auth/login', schema: wireUserSchema },
  logout: { endpoint: 'POST /auth/logout', schema: wireLogoutSchema },
  getMe: { endpoint: 'GET /auth/me', schema: wireUserSchema },
  checkGuestName: { endpoint: 'POST /guests/name-check', schema: wireNameCheckSchema },
  createGuest: { endpoint: 'POST /guests', schema: wireCreateGuestSchema },
  upgradeGuest: { endpoint: 'POST /auth/upgrade', schema: wireUpgradeSchema },
  deleteAccount: { endpoint: 'DELETE /auth/me', schema: wireDeleteAccountSchema },
  listDungeons: { endpoint: 'GET /dungeons', schema: wireDungeonListSchema },
  getDungeon: { endpoint: 'GET /dungeons/{id}', schema: wireDungeonSchema },
  startRun: { endpoint: 'POST /runs', schema: wireRunSchema },
  getRun: { endpoint: 'GET /runs/{id}', schema: wireRunSchema },
  submitAttempt: { endpoint: 'POST /runs/{id}/attempts', schema: wireAttemptSchema },
  clearRoom: { endpoint: 'POST /runs/{id}/rooms/{roomId}/clear', schema: wireClearSchema },
  finishRun: { endpoint: 'POST /runs/{id}/finish', schema: wireFinishSchema },
  getPacks: { endpoint: 'GET /packs', schema: wirePacksSchema },
  getBoard: { endpoint: 'GET /leaderboard', schema: wireBoardSchema },
  getProgress: { endpoint: 'GET /progress', schema: wireProgressSchema },
  getDueReviews: { endpoint: 'GET /reviews/due', schema: wireDueReviewsSchema },
  uploadDocument: { endpoint: 'POST /documents', schema: wireDocumentUploadSchema },
  getDocumentStatus: { endpoint: 'GET /documents/{id}/status', schema: wireDocumentStatusSchema },
  getDocumentTopics: { endpoint: 'GET /documents/{id}/topics', schema: wireDocumentTopicsSchema },
  generateDungeon: { endpoint: 'POST /documents/{id}/generate-dungeon', schema: wireDungeonSchema },
  retryDocument: { endpoint: 'POST /documents/{id}/retry', schema: wireDocumentUploadSchema },
} as const
