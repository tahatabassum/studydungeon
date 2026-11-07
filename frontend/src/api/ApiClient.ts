import type {
  AnswerResult,
  AttemptRequest,
  ClearRoomResponse,
  DemoSessionResponse,
  Dungeon,
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
}
