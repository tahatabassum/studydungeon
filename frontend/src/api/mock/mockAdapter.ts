import type { ApiClient } from '../ApiClient'
import { ApiError } from '../errors'
import demoDungeonJson from '../../demo/demoDungeon.json'
import { BOSS_PROFILE, INITIAL_STATE, ROOM_PROFILE, applyAnswer } from '../../demo/rules'
import type { AnswerResult, Dungeon, Room, RunSummary } from '../../types/api'
import { answerKey } from './answerKey'

export interface MockAdapterOptions {
  /** Artificial latency in ms. Default 0. */
  delayMs?: number
}

const ROOM_CLEAR_XP = 25
const BOSS_CLEAR_XP = 100
const DAY_MS = 24 * 60 * 60 * 1000

const demoDungeon = demoDungeonJson as Dungeon

type DemoRoom = Room & { order: number; is_boss: boolean }

const orderedRooms: DemoRoom[] = [...(demoDungeon.rooms as DemoRoom[])].sort(
  (a, b) => a.order - b.order,
)
const bossRoom = orderedRooms.find((r) => r.is_boss)

/** question id -> owning room (question ids are unique per monster). */
const roomOfQuestion = new Map<string, DemoRoom>()
for (const room of orderedRooms) {
  for (const qid of room.monster.question_ids) roomOfQuestion.set(qid, room)
}

interface RunRecord {
  dungeonId: string
  playerHp: number
  streak: number
  /** room id -> remaining monster HP */
  monsterHp: Map<string, number>
  cleared: Set<string>
  attempts: Map<string, AnswerResult>
  correct: number
  total: number
  score: number
  xp: number
  finished: boolean
  summary: RunSummary | null
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
      const first = orderedRooms[0]
      runs.set(id, {
        dungeonId,
        playerHp: INITIAL_STATE.playerHp,
        streak: 0,
        monsterHp: new Map(orderedRooms.map((r) => [r.id, r.monster.max_hp])),
        cleared: new Set(),
        attempts: new Map(),
        correct: 0,
        total: 0,
        score: 0,
        xp: 0,
        finished: false,
        summary: null,
      })
      return {
        id,
        dungeon_id: dungeonId,
        player_hp: INITIAL_STATE.playerHp,
        monster_hp: first.monster.max_hp,
        current_room_id: first.id,
      }
    },

    async submitAttempt(runId, req) {
      await wait()
      const run = getRun(runId)
      const stored = run.attempts.get(req.attempt_id)
      if (stored) return structuredClone(stored)

      const entry = answerKey[req.question_id]
      if (!entry) throw new ApiError(422, `Unknown question: ${req.question_id}`)

      const room = roomOfQuestion.get(req.question_id)
      if (!room) throw new ApiError(422, `Question has no room: ${req.question_id}`)
      const roomHp = run.monsterHp.get(room.id) ?? 0
      if (roomHp <= 0) throw new ApiError(409, 'Monster is already defeated')
      if (run.playerHp <= 0) throw new ApiError(409, 'Player is defeated')

      const isCorrect = req.selected_answer === entry.correct
      const { next, result } = applyAnswer(
        { playerHp: run.playerHp, monsterHp: roomHp, streak: run.streak },
        isCorrect,
        room.is_boss ? BOSS_PROFILE : ROOM_PROFILE,
      )
      const full: AnswerResult = {
        ...result,
        source: { page: entry.page, chunk_id: entry.chunk_id },
        ...(entry.explanation !== undefined ? { explanation: entry.explanation } : {}),
      }
      run.playerHp = next.playerHp
      run.streak = next.streak
      run.monsterHp.set(room.id, next.monsterHp)
      run.total += 1
      if (isCorrect) run.correct += 1
      run.score += result.score_delta
      run.xp += result.xp_delta
      run.attempts.set(req.attempt_id, full)
      return structuredClone(full)
    },

    async clearRoom(runId, roomId) {
      await wait()
      const run = getRun(runId)
      const room = orderedRooms.find((r) => r.id === roomId)
      if (!room) throw new ApiError(404, `Room not found: ${roomId}`)
      if ((run.monsterHp.get(roomId) ?? 0) > 0) throw new ApiError(409, 'Monster is still alive')
      const xpDelta = room.is_boss ? BOSS_CLEAR_XP : ROOM_CLEAR_XP
      if (!run.cleared.has(roomId)) {
        run.cleared.add(roomId)
        run.xp += xpDelta
      }
      return { xp_delta: xpDelta }
    },

    async finishRun(runId) {
      await wait()
      const run = getRun(runId)
      if (!bossRoom || !run.cleared.has(bossRoom.id)) {
        throw new ApiError(409, 'Boss has not been defeated')
      }
      if (!run.summary) {
        run.finished = true
        run.summary = {
          score: run.score,
          xp: run.xp,
          correct: run.correct,
          total: run.total,
          accuracy: run.total === 0 ? 0 : run.correct / run.total,
        }
      }
      return { ...run.summary }
    },
  }
}
export const mockAdapter: ApiClient = createMockAdapter()
export default mockAdapter
