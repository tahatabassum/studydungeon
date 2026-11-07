import type { ApiClient } from '../ApiClient'
import { ApiError } from '../errors'
import demoDungeonJson from '../../demo/demoDungeon.json'
import { INITIAL_STATE, applyAnswer, type RulesState } from '../../demo/rules'
import type { AnswerResult, Dungeon } from '../../types/api'
import { answerKey } from './answerKey'

export interface MockAdapterOptions {
  /** Artificial latency in ms. Default 0. */
  delayMs?: number
}

const ROOM_CLEAR_XP = 25
const DAY_MS = 24 * 60 * 60 * 1000

const demoDungeon = demoDungeonJson as Dungeon

interface RunRecord {
  dungeonId: string
  state: RulesState
  attempts: Map<string, AnswerResult>
}

const randomSuffix = (): string => Math.random().toString(36).slice(2, 6).padEnd(4, '0')

export function createMockAdapter(options: MockAdapterOptions = {}): ApiClient {
  const delayMs = options.delayMs ?? 0
  const runs = new Map<string, RunRecord>()
  let runCounter = 0

  const wait = async (): Promise<void> => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const getRun = (runId: string): RunRecord => {
    const run = runs.get(runId)
    if (!run) throw new ApiError(404, `Run not found: ${runId}`)
    return run
  }

  return {
    async startDemoSession() {
      await wait()
      const suffix = randomSuffix()
      return {
        user: { id: `guest-${suffix}`, username: `guest-${suffix}`, is_guest: true },
        dungeon_id: demoDungeon.id,
        expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      }
    },

    async getDungeon(id) {
      await wait()
      if (id !== demoDungeon.id) throw new ApiError(404, `Dungeon not found: ${id}`)
      return structuredClone(demoDungeon)
    },

    async startRun(dungeonId) {
      await wait()
      if (dungeonId !== demoDungeon.id) throw new ApiError(404, `Dungeon not found: ${dungeonId}`)
      runCounter += 1
      const id = `run-${runCounter}-${randomSuffix()}`
      runs.set(id, { dungeonId, state: { ...INITIAL_STATE }, attempts: new Map() })
      return {
        id,
        dungeon_id: dungeonId,
        player_hp: INITIAL_STATE.playerHp,
        monster_hp: INITIAL_STATE.monsterHp,
      }
    },

    async submitAttempt(runId, req) {
      await wait()
      const run = getRun(runId)
      const stored = run.attempts.get(req.attempt_id)
      if (stored) return structuredClone(stored)

      const entry = answerKey[req.question_id]
      if (!entry) throw new ApiError(422, `Unknown question: ${req.question_id}`)

      const { next, result } = applyAnswer(run.state, req.selected_answer === entry.correct)
      const full: AnswerResult = {
        ...result,
        source: { page: entry.page, chunk_id: entry.chunk_id },
        ...(entry.explanation !== undefined ? { explanation: entry.explanation } : {}),
      }
      run.state = next
      run.attempts.set(req.attempt_id, full)
      return structuredClone(full)
    },

    async clearRoom(runId, roomId) {
      await wait()
      const run = getRun(runId)
      const room = demoDungeon.rooms.find((r) => r.id === roomId)
      if (!room) throw new ApiError(404, `Room not found: ${roomId}`)
      if (run.state.monsterHp > 0) throw new ApiError(409, 'Monster is still alive')
      return { xp_delta: ROOM_CLEAR_XP }
    },
  }
}

export const mockAdapter: ApiClient = createMockAdapter()
export default mockAdapter
