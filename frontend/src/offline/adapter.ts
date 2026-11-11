import type { ApiClient } from '../api/ApiClient'
import { ApiError } from '../api/errors'
import { evaluateBadges, mergeBadges, type RoomRecord } from '../badges/rules'
import { readFlags } from '../config/flags'
import { drawQuestions } from '../learning/draw'
import { buildFloors, type FloorDef } from '../learning/floors'
import { progressFromXp } from '../learning/level'
import { createMasteryStore } from '../learning/masteryStore'
import { RANK_VALUE } from '../learning/rank'
import { buildQueue, onAnswer, type RequeueState } from '../learning/requeue'
import type {
  AnswerResult,
  Dungeon,
  FloorRank,
  FloorStatus,
  Question,
  Room,
  RunMode,
  RunSummary,
} from '../types/api'
import { WEAPONS } from '../weapons/weapons'
import bundleJson from './demoDungeon.json'
import { OFFLINE_RIVALS, rankAmongRivals, rivalEntries } from './rivals'
import { INITIAL_STATE, RETRY_MULTIPLIER, clearXp, floorRankOf, resolveAttempt } from './rules'

/** Everything the adapter needs from outside, so a run is a pure function of its inputs (Req 14.5). */
export interface OfflineOptions {
  /** Clock in ms. Used only for timestamps (session expiry, finished_at), never for an outcome. */
  now: () => number
  /** Id source, e.g. `nextId('run')`. Injected so ids repeat exactly across two adapters. */
  nextId: (prefix: string) => string
  /** Artificial latency in ms. Default 0. */
  delayMs?: number
}

interface Bundle {
  id: string
  name: string
  rooms: Room[]
  floors: { id: string; index: number; title: string; room_ids: string[] }[]
  final_boss_room_id: string
  questions: Question[]
  answers: Record<string, { correct_option: number; evidence_quote: string; explanation: string }>
}

const bundle = bundleJson as unknown as Bundle
const DAY_MS = 24 * 60 * 60 * 1000

/** The offline demo dungeon id equals the Demo_Board id, so the leaderboard screens find it. */
export const OFFLINE_DUNGEON_ID = bundle.id
export const OFFLINE_USER_ID = 'offline-guest'

const rooms: Room[] = [...bundle.rooms].sort((a, b) => a.order - b.order)
const roomById = new Map(rooms.map((r) => [r.id, r]))
const roomOfQuestion = new Map<string, Room>()
for (const room of rooms) for (const qid of room.monster.question_ids) roomOfQuestion.set(qid, room)
const questionById = new Map(bundle.questions.map((q) => [q.id, q]))
const floorDefs: FloorDef[] = bundle.floors.map((f) => ({ id: f.id, index: f.index, title: f.title, roomIds: f.room_ids }))

/** The correct option text per question (bundled for offline play only; never part of a Question). */
const correctOption = new Map<string, string>()
for (const q of bundle.questions) correctOption.set(q.id, q.options[bundle.answers[q.id].correct_option])

interface ScopedRun {
  mode: RunMode
  floorId: string | null
  roomIds: string[]
  runSeed: string
  queue: RequeueState
  wrongBefore: Set<string>
  asked: Set<string>
  firstTryCorrect: Set<string>
  retries: number
}

interface RunRecord {
  dungeonId: string
  playerHp: number
  streak: number
  maxStreak: number
  monsterHp: Map<string, number>
  cleared: Set<string>
  attempts: Map<string, AnswerResult>
  correct: number
  total: number
  score: number
  xp: number
  summary: RunSummary | null
  finishedAt: number | null
  missed: Map<string, { text: string; page: number }>
  scoped: ScopedRun | null
  /** Badge inputs: answers and HP lost per room, and HP lost overall. */
  roomStats: Map<string, { correct: number; wrong: number; damage: number }>
  damageTaken: number
}

/** The Offline_Adapter: the whole game served from the bundled demo dungeon, nothing saved. */
export function createAdapter(options: OfflineOptions): ApiClient {
  const delayMs = options.delayMs ?? 0
  const runs = new Map<string, RunRecord>()
  const mastery = createMasteryStore()
  const ranks = new Map<string, FloorRank>()
  const forced = new Map<string, FloorStatus>()
  let runCounter = 0

  const wait = async (): Promise<void> => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  const notFound = (id: string): ApiError => new ApiError(404, `Dungeon not found: ${id}`)
  const getRunRecord = (runId: string): RunRecord => {
    const run = runs.get(runId)
    if (!run) throw new ApiError(404, `Run not found: ${runId}`)
    return run
  }

  const clearedRooms = (): Set<string> => {
    const all = new Set<string>()
    for (const run of runs.values()) for (const id of run.cleared) all.add(id)
    return all
  }
  const floorView = () =>
    buildFloors(floorDefs, rooms, {
      clearedRoomIds: clearedRooms(),
      ranks,
      masteryOf: (id) => mastery.get(id),
      forced,
      finalBossRoomId: bundle.final_boss_room_id,
    })
  const totalXp = (exclude?: RunRecord): number => {
    let sum = 0
    for (const run of runs.values()) if (run !== exclude) sum += run.xp
    return sum
  }

  return {
    // The offline demo has no accounts: the label says progress is not saved.
    // Floor-scoped runs work; the Daily Haunt and the practice modes (Weak Topics, Exam, Replay) do not.
    capabilities: { roomRevenants: false, floors: true, modes: true, practiceModes: false, dailyHaunt: false, leaderboard: true, uploads: false,
      // frontend-10 task 3.3 (D28): the offline demo has no identity, packs, live board, counter or quota.
      guestIdentity: false, accountUpgrade: false, accountDelete: false, packs: false, liveBoard: false,
      playerCounter: false, uploadQuota: false, guestUpload: false },

    async register() {
      throw new ApiError(503, 'Accounts are not available in the offline demo.', 'OFFLINE')
    },
    async login() {
      throw new ApiError(503, 'Accounts are not available in the offline demo.', 'OFFLINE')
    },
    async logout() {},
    async getMe() {
      return null
    },

    async startDemoSession() {
      await wait()
      return {
        user: { id: OFFLINE_USER_ID, username: OFFLINE_USER_ID, is_guest: true },
        dungeon_id: bundle.id,
        expires_at: new Date(options.now() + DAY_MS).toISOString(),
      }
    },

    async getDungeon(id) {
      await wait()
      if (id !== bundle.id) throw notFound(id)
      const view = floorView()
      const dungeon: Dungeon = {
        id: bundle.id,
        name: bundle.name,
        rooms: structuredClone(rooms).map((room) => {
          const floorId = view.roomFloor.get(room.id)
          return floorId ? { ...room, floor_id: floorId } : room
        }),
        questions: structuredClone(bundle.questions),
        floors: view.floors,
      }
      if (view.final_boss) dungeon.final_boss = view.final_boss
      return dungeon
    },

    async startRun(request) {
      await wait()
      const dungeonId = typeof request === 'string' ? request : request.dungeon_id
      if (dungeonId !== bundle.id) throw notFound(dungeonId)
      runCounter += 1
      let scoped: ScopedRun | null = null
      if (typeof request !== 'string') {
        const mode = request.mode
        if (mode !== 'floor' && mode !== 'replay_floor') {
          throw new ApiError(422, 'That mode is not available in the offline demo.', 'MODE_UNSUPPORTED')
        }
        const floorId = request.floor_id
        if (floorId === null) throw new ApiError(422, 'A floor is required for this mode.', 'FLOOR_REQUIRED')
        const view = floorView()
        const floor = view.floors.find((f) => f.id === floorId)
        let roomIds: string[]
        if (floor) {
          if (floor.status === 'locked') throw new ApiError(409, 'That floor is still locked.', 'FLOOR_LOCKED')
          if (floor.status === 'generating' || floor.status === 'failed') {
            throw new ApiError(409, 'That floor is not ready yet.', 'FLOOR_NOT_READY')
          }
          if (mode === 'replay_floor' && floor.status !== 'cleared') {
            throw new ApiError(409, 'Only cleared floors can be replayed.', 'FLOOR_NOT_CLEARED')
          }
          roomIds = floor.room_ids
        } else if (view.final_boss && floorId === view.final_boss.id) {
          if (!view.final_boss.unlocked) throw new ApiError(409, 'The final boss is still locked.', 'FLOOR_LOCKED')
          roomIds = [bundle.final_boss_room_id]
        } else {
          throw new ApiError(404, `Floor not found: ${floorId}`, 'FLOOR_NOT_FOUND')
        }
        const runSeed = `${dungeonId}:${floorId}:${runCounter}`
        const pool = roomIds.flatMap((rid) => (roomById.get(rid)?.monster.question_ids ?? []).flatMap((qid) => {
          const q = questionById.get(qid)
          return q ? [q] : []
        }))
        scoped = {
          mode,
          floorId,
          roomIds,
          runSeed,
          queue: buildQueue(drawQuestions(pool, runSeed).map((q) => q.id)),
          wrongBefore: new Set(),
          asked: new Set(),
          firstTryCorrect: new Set(),
          retries: 0,
        }
      }
      const id = options.nextId('run')
      const first = scoped ? (roomById.get(scoped.roomIds[0]) ?? rooms[0]) : rooms[0]
      runs.set(id, {
        dungeonId,
        playerHp: INITIAL_STATE.playerHp,
        streak: 0,
        maxStreak: 0,
        monsterHp: new Map(rooms.map((r) => [r.id, r.monster.max_hp])),
        cleared: new Set(),
        attempts: new Map(),
        correct: 0,
        total: 0,
        score: 0,
        xp: 0,
        summary: null,
        finishedAt: null,
        missed: new Map(),
        scoped,
        roomStats: new Map(),
        damageTaken: 0,
      })
      return {
        id,
        dungeon_id: dungeonId,
        player_hp: INITIAL_STATE.playerHp,
        monster_hp: first.monster.max_hp,
        current_room_id: first.id,
        ...(scoped ? { mode: scoped.mode, run_seed: scoped.runSeed } : {}),
      }
    },

    async submitAttempt(runId, req) {
      await wait()
      const run = getRunRecord(runId)
      const stored = run.attempts.get(req.attempt_id)
      if (stored) return structuredClone(stored)

      const question = questionById.get(req.question_id)
      const room = roomOfQuestion.get(req.question_id)
      if (!question || !room) throw new ApiError(422, `Unknown question: ${req.question_id}`)
      const roomHp = run.monsterHp.get(room.id) ?? 0
      if (roomHp <= 0) throw new ApiError(409, 'Monster is already defeated')
      if (run.playerHp <= 0) throw new ApiError(409, 'Player is defeated')

      const scoped = run.scoped
      if (scoped && !scoped.roomIds.includes(room.id)) {
        throw new ApiError(409, 'That question is not on this floor.', 'OUT_OF_SCOPE')
      }

      const isCorrect = req.selected_answer === correctOption.get(req.question_id)
      const isRetry = scoped !== null && scoped.wrongBefore.has(req.question_id)
      const { next, result, critical } = resolveAttempt({
        state: { playerHp: run.playerHp, monsterHp: roomHp, streak: run.streak },
        correct: isCorrect,
        isBoss: room.is_boss,
        hard: question.difficulty === 'hard',
        isRetry,
      })
      const answer = bundle.answers[req.question_id]
      const full: AnswerResult = {
        ...result,
        evidence_quote: answer.evidence_quote,
        explanation: answer.explanation,
        weapon_id: WEAPONS[0].id,
        is_critical: critical,
      }
      if (scoped) {
        const outcome = onAnswer(scoped.queue, req.question_id, isCorrect)
        scoped.queue = outcome.state
        if (isRetry) scoped.retries += 1
        if (!scoped.asked.has(req.question_id)) {
          scoped.asked.add(req.question_id)
          if (isCorrect) scoped.firstTryCorrect.add(req.question_id)
        }
        if (!isCorrect) scoped.wrongBefore.add(req.question_id)
        full.requeue_after = outcome.requeueAfter
        full.is_retry = isRetry
        if (isRetry) full.retry_multiplier = RETRY_MULTIPLIER
        full.combo = next.streak
        if (!isCorrect) full.correct_answer = correctOption.get(req.question_id) ?? ''
      }
      mastery.record(room.id, isCorrect)
      const lost = Math.max(0, run.playerHp - next.playerHp)
      run.damageTaken += lost
      const rs = run.roomStats.get(room.id) ?? { correct: 0, wrong: 0, damage: 0 }
      if (isCorrect) rs.correct += 1
      else rs.wrong += 1
      rs.damage += lost
      run.roomStats.set(room.id, rs)
      run.playerHp = next.playerHp
      run.streak = next.streak
      run.maxStreak = Math.max(run.maxStreak, next.streak)
      if (!isCorrect && !run.missed.has(req.question_id)) {
        run.missed.set(req.question_id, { text: question.prompt, page: room.order })
      }
      run.monsterHp.set(room.id, next.monsterHp)
      run.total += 1
      if (isCorrect) run.correct += 1
      run.score += result.score_delta
      run.xp += result.xp_delta ?? 0
      run.attempts.set(req.attempt_id, full)
      return structuredClone(full)
    },

    async clearRoom(runId, roomId) {
      await wait()
      const run = getRunRecord(runId)
      const room = roomById.get(roomId)
      if (!room) throw new ApiError(404, `Room not found: ${roomId}`)
      if ((run.monsterHp.get(roomId) ?? 0) > 0) throw new ApiError(409, 'Monster is still alive')
      const xp = clearXp(room.is_boss)
      if (!run.cleared.has(roomId)) {
        run.cleared.add(roomId)
        run.xp += xp
      }
      return { xp_delta: xp }
    },

    async finishRun(runId) {
      await wait()
      const run = getRunRecord(runId)
      const scoped = run.scoped
      const gateRoomId = scoped ? scoped.roomIds[scoped.roomIds.length - 1] : bundle.final_boss_room_id
      if (!run.cleared.has(gateRoomId)) throw new ApiError(409, 'Boss has not been defeated', 'BOSS_NOT_CLEARED')
      if (!run.summary) {
        const accuracy = run.total === 0 ? 0 : run.correct / run.total
        const summary: RunSummary = {
          score: run.score,
          xp: run.xp,
          correct: run.correct,
          total: run.total,
          accuracy,
        }
        const topicRooms = (scoped ? scoped.roomIds : rooms.map((r) => r.id)).flatMap((id) => {
          const r = roomById.get(id)
          return r ? [r] : []
        })
        summary.mastery_by_topic = topicRooms.map((r) => ({ topic_id: r.id, title: r.label, mastery: mastery.get(r.id) }))
        if (scoped && scoped.floorId) {
          const rank = floorRankOf(scoped.firstTryCorrect.size, scoped.asked.size, scoped.retries)
          summary.floor_rank = rank
          const best = ranks.get(scoped.floorId)
          if (!best || RANK_VALUE[rank] > RANK_VALUE[best]) ranks.set(scoped.floorId, rank)
          summary.chest_rewards = [
            { id: 'chest-xp', kind: 'xp', label: 'Bonus XP', amount: 10 * (RANK_VALUE[rank] + 1) },
            { id: 'chest-coins', kind: 'coins', label: 'Crypt coins', amount: 15 * (RANK_VALUE[rank] + 1) },
          ]
        }
        // Badges (frontend-07 Phase 7), computed here because the offline demo has no Backend.
        const doneRooms = clearedRooms()
        const roomRecords: RoomRecord[] = [...run.cleared].map((id) => {
          const rs = run.roomStats.get(id)
          return { correct: rs?.correct ?? 0, wrong: rs?.wrong ?? 0, damageTaken: rs?.damage ?? 0, cleared: true }
        })
        summary.badges_earned = evaluateBadges(
          {
            rooms: roomRecords,
            correct: run.correct,
            wrong: run.total - run.correct,
            damageTaken: run.damageTaken,
            bossCleared: run.cleared.has(gateRoomId) || rooms.some((r) => r.is_boss && run.cleared.has(r.id)),
            maxStreak: run.maxStreak,
            revenantsCleared: 0,
            allRoomsCleared: rooms.every((r) => doneRooms.has(r.id)),
          },
          { speedReader: readFlags().badgeSpeedReader },
        )
        const before = progressFromXp(totalXp(run)).level
        const after = progressFromXp(totalXp()).level
        summary.level_up = after > before ? { from: before, to: after } : null
        summary.weapon_unlocked = null
        summary.weak_concepts = [...run.missed.values()].slice(0, 5)
        summary.leaderboard_rank = rankAmongRivals({ score: run.score, accuracy, bestStreak: run.maxStreak }, 'You')
        run.finishedAt = options.now()
        run.summary = summary
      }
      return structuredClone(run.summary)
    },

    async getProgress() {
      await wait()
      const base = progressFromXp(totalXp())
      return {
        ...base,
        unlocked_weapons: ['rusty_dagger'],
        weapons: WEAPONS.map((w, i) => ({
          id: w.id,
          unlock_level: i === 0 ? 1 : base.level + 1,
          requirement: w.requirement,
        })),
        due_review_count: 0,
        badges: mergeBadges([...runs.values()].map((r) => r.summary?.badges_earned)),
        recent_runs: [...runs.values()]
          .filter((r) => r.summary !== null)
          .reverse()
          .slice(0, 5)
          .map((r, i) => ({
            id: `recent-${i + 1}`,
            dungeon_name: bundle.name,
            score: r.summary?.score ?? 0,
            accuracy: r.summary?.accuracy ?? 0,
            finished_at: new Date(r.finishedAt ?? options.now()).toISOString(),
          })),
      }
    },

    async getLeaderboard(query) {
      await wait()
      const limit = Math.max(1, Math.floor(query.limit ?? 20))
      const entries = query.dungeonId === bundle.id ? rivalEntries(query.period).slice(0, limit) : []
      return {
        entries,
        me: { rank: null, is_provisional: false, entry: null },
        updated_at: new Date(options.now()).toISOString(),
      }
    },

    async getRun(runId) {
      await wait()
      const run = getRunRecord(runId)
      const order = run.scoped ? run.scoped.roomIds.flatMap((id) => (roomById.get(id) ? [roomById.get(id) as Room] : [])) : rooms
      const current = order.find((r) => !run.cleared.has(r.id)) ?? order[order.length - 1]
      return {
        id: runId,
        dungeon_id: run.dungeonId,
        player_hp: run.playerHp,
        monster_hp: run.monsterHp.get(current.id) ?? current.monster.max_hp,
        current_room_id: current.id,
        score: run.score,
        streak: run.streak,
      }
    },

    // No reviews offline: the shape is valid and empty.
    getDueReviews: (async (dungeonId?: string) => {
      await wait()
      if (dungeonId === undefined) return { due_count: 0, next_due_at: null, daily_streak: 0, items: [] }
      if (dungeonId !== bundle.id) throw notFound(dungeonId)
      return []
    }) as ApiClient['getDueReviews'],

    async getGenerationStatus(dungeonId) {
      await wait()
      if (dungeonId !== bundle.id) throw notFound(dungeonId)
      return { dungeon_id: dungeonId, floors: floorView().floors.map((f) => ({ id: f.id, status: f.status })) }
    },

    async retryFloor(floorId) {
      await wait()
      if (!floorDefs.some((f) => f.id === floorId)) throw new ApiError(404, `Floor not found: ${floorId}`, 'FLOOR_NOT_FOUND')
      throw new ApiError(409, 'That floor has not failed.', 'FLOOR_NOT_FAILED')
    },

    // Uploading needs the server: the offline demo has no documents.
    uploadDocument: unsupportedUpload,
    getDocumentStatus: unsupportedUpload,
    getDocumentTopics: unsupportedUpload,
    generateDungeon: unsupportedUpload,
    retryDocument: unsupportedUpload,
    // frontend-10 task 3.3: the new calls stay 501 here; the capability flags above keep the UI from calling them.
    // The offline demo never supports identity (D28).
    checkGuestName: async () => unsupported('Guest names'),
    createGuest: async () => unsupported('Guest names'),
    upgradeGuest: async () => unsupported('Account upgrade'),
    deleteAccount: async () => unsupported('Account deletion'),
    listDungeons: async () => unsupported('The dungeon list'),
    getPacks: async () => unsupported('Preloaded packs'),
  }
}

async function unsupportedUpload(): Promise<never> {
  throw new ApiError(501, 'Uploading notes needs a connection to the server.', 'UNSUPPORTED')
}

/** The 8 bundled Ghost_Rivals (re-exported for tests). */
export { OFFLINE_RIVALS }

/** frontend-10: the offline demo cannot do this (D28). */
function unsupported(what: string): never {
  throw new ApiError(501, `${what} is not available in the offline demo.`, 'UNSUPPORTED')
}
