import type {
  AnswerResult,
  AttemptRequest,
  AuthMe,
  BoardQuery,
  BoardResponse,
  CapabilityState,
  ClearRoomResponse,
  CreateGuestRequest,
  CreateGuestResponse,
  Credentials,
  DemoSessionResponse,
  DocumentStatus,
  DocumentTopic,
  DocumentUpload,
  DueReview,
  DueReviewsResponse,
  Dungeon,
  DungeonSummary,
  GenerationStatus,
  LeaderboardQuery,
  LeaderboardResponse,
  NameCheckResult,
  PacksResponse,
  PlayerStats,
  ProgressInfo,
  Run,
  RunSummary,
  StartRunRequest,
  UploadQuota,
  User,
} from '../types/api'

/** frontend-10: cceptAiNotice sends the multipart field ccept_ai_notice=true. */
export interface UploadOptions {
  acceptAiNotice?: boolean
}

export interface ApiClient {
  startDemoSession(): Promise<DemoSessionResponse>
  getDungeon(id: string): Promise<Dungeon>
  /**
   * A plain dungeon id starts the whole dungeon (legacy). A StartRunRequest scopes the run to a Floor
   * and a mode (frontend-08); the Http_Client still sends only `{dungeon_id}` until the backend supports it (D18).
   */
  startRun(request: string | StartRunRequest): Promise<Run>
  submitAttempt(runId: string, req: AttemptRequest): Promise<AnswerResult>
  clearRoom(runId: string, roomId: string): Promise<ClearRoomResponse>
  finishRun(runId: string): Promise<RunSummary>
  /** Backend owns level/XP-to-next; the frontend never computes them. */
  getProgress(): Promise<ProgressInfo>
  /**
   * PROPOSED (pending Person A): questions due for review in this dungeon, backed by GET /reviews/due.
   * Person A may instead embed them in the run payload; this method hides the choice from the UI.
   */
  getDueReviews(dungeonId: string): Promise<DueReview[]>
  /** PROPOSED (frontend-08): the new shape `{due_count, next_due_at, daily_streak, items}`. */
  getDueReviews(): Promise<DueReviewsResponse>
  /** PROPOSED (frontend-08): floor statuses, polled while floors are generating. */
  getGenerationStatus(dungeonId: string): Promise<GenerationStatus>
  /** PROPOSED (frontend-08): retries a failed Floor. Rejects when the floor is not failed or unsupported. */
  retryFloor(floorId: string): Promise<void>
  /**
   * PROPOSED (pending Person A): GET /leaderboard. Guests can read it. The real backend has no such
   * endpoint yet: it declares `capabilities.leaderboard = false` and this call rejects with 501.
   */
  getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardResponse>
  /** Rehydrates a run (HP, score, streak, current room) after a reload. Backed by GET /runs/{id}. */
  getRun(runId: string): Promise<Run>
  /** `POST /auth/register` (201, bare user). The session is the httpOnly cookie; nothing is stored in JS (C22, C25). */
  register(credentials: Credentials): Promise<User>
  /** `POST /auth/login` (200, bare user). */
  login(credentials: Credentials): Promise<User>
  /** `POST /auth/logout` (200 `{success: true}`). */
  logout(): Promise<void>
  /** `GET /auth/me`: the current user with the session expiry, or null when there is no session (401). */
  getMe(): Promise<AuthMe | null>
  /** `POST /documents` (multipart, 202). Registered users only: a guest gets 403 GUEST_FORBIDDEN. */
  uploadDocument(file: File, options?: UploadOptions): Promise<DocumentUpload>
  /** `GET /documents/{id}/status`: processing, accepted, rejected (with a reason) or failed. */
  getDocumentStatus(documentId: string): Promise<DocumentStatus>
  /** `GET /documents/{id}/topics`: the topics found in an accepted document. */
  getDocumentTopics(documentId: string): Promise<DocumentTopic[]>
  /** `POST /documents/{id}/generate-dungeon` (201): the new dungeon, with its floors. */
  generateDungeon(documentId: string): Promise<Dungeon>
  /** `POST /documents/{id}/retry`: re-queues a failed or rejected document. */
  retryDocument(documentId: string): Promise<DocumentUpload>
  /** POST /guests/name-check (frontend-10, REAL). A hint only: POST /guests is the authority. */
  checkGuestName(displayName: string): Promise<NameCheckResult>
  /** POST /guests (frontend-10, REAL): creates a named Guest and sets the session cookie. */
  createGuest(request: CreateGuestRequest): Promise<CreateGuestResponse>
  /** POST /auth/upgrade (frontend-10, REAL): turns the current Guest into a registered user. */
  upgradeGuest(credentials: Credentials): Promise<User>
  /** DELETE /auth/me with {confirm: "DELETE"} (frontend-10, REAL). */
  deleteAccount(): Promise<void>
  /** GET /dungeons (frontend-10, REAL, session required). */
  listDungeons(): Promise<DungeonSummary[]>
  /** GET /packs (frontend-10, PROPOSED): the preloaded packs and their status. 501 when unsupported. */
  getPacks(): Promise<PacksResponse>
  /** GET /leaderboard?board=&period= (frontend-10, PROPOSED): the live board of real players with the me block. */
  getBoard(query: BoardQuery): Promise<BoardResponse>
  /** GET /stats/players (frontend-10, PROPOSED): the number of players, for the title line. 501 when unsupported. */
  getPlayerStats(): Promise<PlayerStats>
  /** GET /uploads/quota (frontend-10, PROPOSED): what the player may still upload today. A 2xx for a guest proves guest upload. */
  getUploadQuota(): Promise<UploadQuota>
  /** GET /health ping to wake a cold server. Only the Http client defines it. */
  warmUp?(): Promise<void>
  /**
   * D26: what the backend supports. Absent means everything (the mock). A false value hides the
   * feature in the UI instead of calling an endpoint that does not exist or rejects the call.
   */
  readonly capabilities?: ApiCapabilities
}

/** True when the practice modes (Weak Topics, Exam, Replay Floor) can run on this client (D26). */
export function supportsPracticeModes(api: Pick<ApiClient, 'capabilities'>): boolean {
  const caps = api.capabilities
  return caps === undefined || (caps.modes !== false && caps.practiceModes !== false)
}

export interface ApiCapabilities {
  /** Room-embedded Revenants. The real backend rejects attempts on a cleared room (C19). */
  roomRevenants: boolean
  /** Floors in `GET /dungeons/{id}` (frontend-08 Phase 1B+). */
  floors: boolean
  /** Run modes other than the plain dungeon run (a `startRun` body scoped to a Floor). */
  modes: boolean
  /**
   * Weak Topics, Exam and Replay Floor. Absent means they follow `modes`; false hides them while Floor runs
   * still work (the offline demo).
   */
  practiceModes?: boolean
  /** The Daily Haunt run. */
  dailyHaunt: boolean
  /** GET /leaderboard (frontend-07 Phase 5). False hides the board behind a "coming soon" state. */
  leaderboard: boolean
  /** The document endpoints (frontend-07 Phase 8). Absent means supported; false (the offline demo) hides the wizard. */
  uploads?: boolean
  /** frontend-10 (D2). REAL-now features start true and flip to false on 404, 405 or 501. Absent means on (the mock). */
  guestIdentity?: CapabilityState
  accountUpgrade?: CapabilityState
  accountDelete?: CapabilityState
  /** frontend-10 (D2). PROPOSED features start 'unproven'; the first call is the probe. */
  packs?: CapabilityState
  liveBoard?: CapabilityState
  playerCounter?: CapabilityState
  uploadQuota?: CapabilityState
  guestUpload?: CapabilityState
}

export type CapabilityKey =
  | 'guestIdentity'
  | 'accountUpgrade'
  | 'accountDelete'
  | 'packs'
  | 'liveBoard'
  | 'playerCounter'
  | 'uploadQuota'
  | 'guestUpload'

/** D2: 'on' (true or absent), 'off' (false) or 'unproven'. An absent field means on, like uploads?. */
export function capabilityOf(api: Pick<ApiClient, 'capabilities'>, key: CapabilityKey): 'on' | 'off' | 'unproven' {
  const value = api.capabilities?.[key]
  if (value === undefined || value === true) return 'on'
  return value === false ? 'off' : 'unproven'
}