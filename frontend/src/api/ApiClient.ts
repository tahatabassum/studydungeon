import type {
  AnswerResult,
  AttemptRequest,
  ClearRoomResponse,
  DemoSessionResponse,
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
}
