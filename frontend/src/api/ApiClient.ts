import type {
  AnswerResult,
  AttemptRequest,
  ClearRoomResponse,
  DemoSessionResponse,
  DueReview,
  Dungeon,
  ProgressInfo,
  Run,
  RunSummary,
} from '../types/api'

export interface ApiClient {
  startDemoSession(): Promise<DemoSessionResponse>
  getDungeon(id: string): Promise<Dungeon>
  startRun(dungeonId: string): Promise<Run>
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
  /** Rehydrates a run (HP, score, streak, current room) after a reload. Backed by GET /runs/{id}. */
  getRun(runId: string): Promise<Run>
  /**
   * D26: what the backend supports. Absent means everything (the mock). A false value hides the
   * feature in the UI instead of calling an endpoint that does not exist or rejects the call.
   */
  readonly capabilities?: ApiCapabilities
}

export interface ApiCapabilities {
  /** Room-embedded Revenants. The real backend rejects attempts on a cleared room (C19). */
  roomRevenants: boolean
  /** Floors in `GET /dungeons/{id}` (frontend-08 Phase 1B+). */
  floors: boolean
  /** Run modes other than the plain dungeon run. */
  modes: boolean
  /** The Daily Haunt run. */
  dailyHaunt: boolean
}
