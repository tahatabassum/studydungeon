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
}
