import type { ApiClient } from '../ApiClient'
import { ApiError } from '../errors'
import demoDungeonJson from '../../demo/demoDungeon.json'
import {
  BOSS_PROFILE,
  CRIT_AFTER_STREAK,
  INITIAL_STATE,
  ROOM_PROFILE,
  applyAnswer,
  roundHalfEven,
  strikeDamage,
} from '../../demo/rules'
import type {
  AnswerResult,
  Dungeon,
  FloorRank,
  FloorStatus,
  Question,
  Room,
  RunMode,
  ProgressInfo,
  RunSummary,
  WeaponId,
} from '../../types/api'
import { WEAPONS, bestWeaponAmong, resolveWeapon } from '../../weapons/weapons'
import { readFlags } from '../../config/flags'
import { evaluateBadges, mergeBadges, type RoomRecord } from '../../badges/rules'
import { firstTryAccuracy, RANK_VALUE, rankFor } from '../../learning/rank'
import { answerKey, type AnswerKeyEntry } from './answerKey'
import { drawQuestions } from '../../learning/draw'
import { progressFromXp } from '../../learning/level'
import { buildDueSummary, MOCK_REVIEW_INTERVAL_MS } from './mockHaunt'
import { DEMO_FINAL_BOSS_ROOM_ID, DEMO_FLOOR_DEFS, buildFloors, type FloorDef } from '../../learning/floors'
import { readMockDelayMs, readMockLevel, readMockPlayer } from './mockLevel'
import { createMockAuth } from './mockAuth'
import { createMockUpload, type GeneratedSource } from './mockUpload'
import { createMasteryStore } from '../../learning/masteryStore'
import { buildMockLeaderboard, runRankOnDemoBoard, type StoredRun } from './mockLeaderboard'
import { createReviewStore } from './mockReviews'
import { buildStreakCalendar, notesConqueredPercent } from './mockProgress'
import { authoredPool } from './pool'
import { buildQueue, onAnswer, type RequeueState } from '../../learning/requeue'

/** Retry rule (D21, PROPOSED): a second chance deals half damage and half XP. */
const RETRY_MULTIPLIER = 0.5

export interface MockAdapterOptions {
  /** Dev switch: floor ids that start in the `failed` status until `retryFloor` is called. */
  failedFloorIds?: readonly string[]
  /** Clock in ms for the review schedule. Default Date.now. */
  now?: () => number
  /** Seed due reviews for demos. Defaults to VITE_MOCK_SEED_REVENANTS. */
  seedRevenants?: boolean
  /** Artificial latency in ms. Default 0. */
  delayMs?: number
  /**
   * Extra latency for `startDemoSession` only (dev `VITE_MOCK_DELAY_MS`), so the "Waking up the dungeon..."
   * loader and the Offline demo choice can be seen. Default 0.
   */
  demoSessionDelayMs?: number
  /** Timing of the document pipeline: how long a file stays `processing`, and the gap between generated floors. */
  upload?: { processingMs?: number; stepMs?: number }
  /** Dev override of the player level (from `?mockLevel=N`); otherwise derived from XP. */
  level?: number
  /**
   * Dev switch (`?mockPlayer=1`): the demo session is a signed-in player instead of a guest, so finished
   * runs are stored on the Demo_Board. Default false (a guest has only a provisional rank).
   */
  player?: boolean
}

/** Mock only: demo questions that count as "hard" (damage x1.25, C12). The rest are easy or medium. */
const HARD_QUESTION_IDS: ReadonlySet<string> = new Set(['b2', 'b4', 'b6', 'b8'])

/** Weak Topics (mock): how many of the lowest-mastery topics a run covers. */
const WEAK_TOPIC_COUNT = 2

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

/**
 * Everything a run needs to know about the dungeon it plays: the seeded demo or a dungeon generated from
 * an upload. The rules (applyAnswer, floors, requeue, draw) are shared; only the content differs.
 */
interface DungeonCtx {
  id: string
  rooms: DemoRoom[]
  roomById: Map<string, DemoRoom>
  roomOfQuestion: Map<string, DemoRoom>
  questions: readonly Question[]
  keyOf(questionId: string): AnswerKeyEntry | undefined
  bossRoom: DemoRoom | undefined
  floorDefs: readonly FloorDef[]
  finalBossRoomId: string
  hardIds: ReadonlySet<string>
}

const demoCtx: DungeonCtx = {
  id: demoDungeon.id,
  rooms: orderedRooms,
  roomById: new Map(orderedRooms.map((r) => [r.id, r])),
  roomOfQuestion,
  questions: demoDungeon.questions,
  keyOf: (qid) => answerKey[qid],
  bossRoom,
  floorDefs: DEMO_FLOOR_DEFS,
  finalBossRoomId: DEMO_FINAL_BOSS_ROOM_ID,
  hardIds: HARD_QUESTION_IDS,
}

function ctxFromSource(src: GeneratedSource): DungeonCtx {
  const rooms = [...(src.rooms as DemoRoom[])].sort((a, b) => a.order - b.order)
  const owner = new Map<string, DemoRoom>()
  for (const room of rooms) for (const qid of room.monster.question_ids) owner.set(qid, room)
  return {
    id: src.id,
    rooms,
    roomById: new Map(rooms.map((r) => [r.id, r])),
    roomOfQuestion: owner,
    questions: src.questions,
    keyOf: (qid) => src.answers.get(qid),
    bossRoom: rooms.find((r) => r.is_boss),
    floorDefs: src.floorDefs,
    finalBossRoomId: src.finalBossRoomId,
    hardIds: new Set(),
  }
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
  /** Best streak reached in this run. */
  maxStreak: number
  finishedAt: number | null
  /** Questions answered wrongly, first miss first (the Scorecard's weak concepts). */
  missed: Map<string, { text: string; page: number }>
  /** Set only for runs started with a StartRunRequest (floor-scoped play, frontend-08). */
  scoped: ScopedRun | null
  /** Badge inputs: answers and HP lost per room, HP lost overall, Revenants laid to rest. */
  roomStats: Map<string, { correct: number; wrong: number; damage: number }>
  damageTaken: number
  revenantsRested: number
}

interface ScopedRun {
  mode: RunMode
  floorId: string | null
  /** Rooms this run covers, in play order. */
  roomIds: string[]
  runSeed: string
  queue: RequeueState
  /** Questions answered wrong at least once in this run (a later answer is a retry). */
  wrongBefore: Set<string>
  /** Distinct questions answered, and those answered correctly on their first try. */
  asked: Set<string>
  firstTryCorrect: Set<string>
  retries: number
}


const randomSuffix = (): string => Math.random().toString(36).slice(2, 6).padEnd(4, '0')

export function createMockAdapter(options: MockAdapterOptions = {}): ApiClient {
  const delayMs = options.delayMs ?? 0
  const demoSessionDelayMs = options.demoSessionDelayMs ?? 0
  const runs = new Map<string, RunRecord>()
  let runCounter = 0
  // Due reviews persist across runs of this adapter instance, like a real review schedule.
  const reviews = createReviewStore(
    orderedRooms.map((r) => ({
      id: r.id,
      order: r.order,
      is_boss: r.is_boss,
      question_ids: r.monster.question_ids,
    })),
    options.seedRevenants ?? readFlags().mockSeedRevenants,
  )

  const now = options.now ?? Date.now
  const auth = createMockAuth({ now })
  const upload = createMockUpload({ now, session: () => auth.getMe(), ...options.upload })
  const mastery = createMasteryStore()
  const ranks = new Map<string, FloorRank>()
  const forced = new Map<string, FloorStatus>((options.failedFloorIds ?? []).map((id) => [id, 'failed']))
  /** Question id -> ms when the next review falls due, for questions answered correctly. */
  const scheduled = new Map<string, number>()
  let dailyStreak = 0
  let lastHauntDay = ''
  /** The dungeon a run plays: the demo, or a dungeon generated from an upload (its content is static once built). */
  const generatedCtx = new Map<string, DungeonCtx>()
  const ctxFor = (dungeonId: string): DungeonCtx => {
    if (dungeonId === demoDungeon.id) return demoCtx
    const known = generatedCtx.get(dungeonId)
    if (known) return known
    const src = upload.source(dungeonId)
    if (!src) throw new ApiError(404, `Dungeon not found: ${dungeonId}`)
    const ctx = ctxFromSource(src)
    generatedCtx.set(dungeonId, ctx)
    return ctx
  }

  // Only floor-style runs (and the legacy whole-dungeon run) move the campaign forward. Practice modes
  // (weak topics, exam, daily haunt) never clear a floor.
  const clearedRooms = (): Set<string> => {
    const all = new Set<string>()
    for (const run of runs.values()) {
      const mode = run.scoped?.mode
      if (mode === 'weak_topics' || mode === 'exam' || mode === 'daily_haunt') continue
      for (const id of run.cleared) all.add(id)
    }
    return all
  }
  const demoFloorView = () =>
    buildFloors(DEMO_FLOOR_DEFS, orderedRooms, {
      clearedRoomIds: clearedRooms(),
      ranks,
      masteryOf: (id) => mastery.get(id),
      forced,
    })
  const floorView = demoFloorView
  /** What play has done so far, overlaid on a generated dungeon's floors. */
  const playState = () => ({ cleared: clearedRooms(), ranks, masteryOf: (id: string) => mastery.get(id) })
  /** Floors, the final boss and the room -> floor map of any playable dungeon. */
  const floorViewOf = (ctx: DungeonCtx): ReturnType<typeof demoFloorView> => {
    if (ctx === demoCtx) return demoFloorView()
    const dungeon = upload.dungeon(ctx.id, playState())
    const floors = dungeon?.floors ?? []
    const roomFloor = new Map<string, string>()
    for (const f of floors) for (const rid of f.room_ids) roomFloor.set(rid, f.id)
    return { floors, final_boss: dungeon?.final_boss, roomFloor }
  }

  /** PROPOSED frontend-08 progress fields. Mastery is the mock's EMA; the calendar follows the Daily Haunt streak. */
  const proposedProgress = (): Pick<ProgressInfo, 'notes_conquered_percent' | 'memory_strength' | 'streak_calendar' | 'weak_concepts'> => {
    const topics = orderedRooms.filter((r) => !r.is_boss)
    const cleared = clearedRooms()
    const missed = new Map<string, { text: string; page: number }>()
    for (const run of runs.values()) for (const [id, m] of run.missed) if (!missed.has(id)) missed.set(id, m)
    const today = new Date(now()).toISOString().slice(0, 10)
    return {
      notes_conquered_percent: notesConqueredPercent(topics.filter((r) => cleared.has(r.id)).length, topics.length),
      memory_strength: topics
        .filter((r) => mastery.get(r.id) > 0)
        .map((r) => ({ topic_id: r.id, title: r.label, strength: mastery.get(r.id) })),
      streak_calendar: buildStreakCalendar(now(), dailyStreak, lastHauntDay === today),
      weak_concepts: [...missed.values()].slice(0, 5).map((m) => ({ text: m.text, page: m.page })),
    }
  }

  const hauntInputs = () => ({
    due: reviews.list(demoDungeon.questions),
    scheduled,
    nowMs: now(),
    dailyStreak,
  })

  const totalXp = (exclude?: RunRecord): number => {
    let sum = 0
    for (const run of runs.values()) if (run !== exclude) sum += run.xp
    return sum
  }
  /** Player level: the dev override when given, else derived from cumulative XP. */
  const playerLevel = (exclude?: RunRecord): number => options.level ?? progressFromXp(totalXp(exclude)).level

  // Leaderboard (D24, PROPOSED): finished runs the board knows, and the name of the last demo session.
  const finishedRuns: StoredRun[] = []
  const isGuestPlayer = !(options.player ?? false)
  let sessionName = 'Guest'

  /**
   * Real unlock rules (C13): staff at 100 XP, crossbow after clearing 2 rooms, hammer at level 3,
   * sigil after the first boss. The dagger is always unlocked. Cumulative across runs of this adapter.
   * `exclude` leaves one run out, to see what was unlocked before it.
   */
  const unlockedWeapons = (exclude?: RunRecord): WeaponId[] => {
    let cleared = 0
    let bosses = 0
    for (const run of runs.values()) {
      if (run === exclude) continue
      cleared += run.cleared.size
      if (bossRoom && run.cleared.has(bossRoom.id)) bosses += 1
    }
    const xp = totalXp(exclude)
    const level = playerLevel(exclude)
    const ids: WeaponId[] = ['rusty_dagger']
    if (xp >= 100) ids.push('arcane_staff')
    if (cleared >= 2) ids.push('hunter_crossbow')
    if (level >= 3) ids.push('spectral_hammer')
    if (bosses >= 1) ids.push('flame_sigil')
    return ids
  }

  /** Every badge earned so far in this adapter session (the Dashboard grid and the player's board row). */
  const earnedBadges = () => mergeBadges([...runs.values()].map((r) => r.summary?.badges_earned))

  const wait = async (): Promise<void> => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const getRun = (runId: string): RunRecord => {
    const run = runs.get(runId)
    if (!run) throw new ApiError(404, `Run not found: ${runId}`)
    return run
  }

  return {
    register: (credentials) => auth.register(credentials),
    login: (credentials) => auth.login(credentials),
    logout: () => auth.logout(),
    getMe: () => auth.getMe(),

    async startDemoSession() {
      await wait()
      if (demoSessionDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, demoSessionDelayMs))
      const suffix = randomSuffix()
      sessionName = isGuestPlayer ? `guest-${suffix}` : `hero-${suffix}`
      auth.adopt({ id: sessionName, username: sessionName, is_guest: isGuestPlayer })
      return {
        user: { id: sessionName, username: sessionName, is_guest: isGuestPlayer },
        dungeon_id: demoDungeon.id,
        expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      }
    },

    async getDungeon(id) {
      await wait()
      const generated = upload.dungeon(id, playState())
      if (generated) return generated
      if (id !== demoDungeon.id) throw new ApiError(404, `Dungeon not found: ${id}`)
      const view = floorView()
      const dungeon = structuredClone(demoDungeon)
      for (const room of dungeon.rooms) {
        const floorId = view.roomFloor.get(room.id)
        if (floorId) room.floor_id = floorId
      }
      dungeon.floors = view.floors
      if (view.final_boss) dungeon.final_boss = view.final_boss
      return dungeon
    },

    async startRun(request) {
      await wait()
      const dungeonId = typeof request === 'string' ? request : request.dungeon_id
      const ctx = ctxFor(dungeonId)
      let scoped: ScopedRun | null = null
      const mode: RunMode = typeof request === 'string' ? 'floor' : request.mode
      if (typeof request !== 'string') {
        const view = floorViewOf(ctx)
        const floorId = request.floor_id
        let roomIds: string[]
        if (mode === 'floor' || mode === 'replay_floor') {
          if (floorId === null) throw new ApiError(422, 'A floor is required for this mode.', 'FLOOR_REQUIRED')
          const floor = view.floors.find((f) => f.id === floorId)
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
            roomIds = [ctx.finalBossRoomId]
          } else {
            throw new ApiError(404, `Floor not found: ${floorId}`, 'FLOOR_NOT_FOUND')
          }
        } else if (mode === 'weak_topics') {
          // The lowest-mastery topics (ties by dungeon order), played in dungeon order. The boss is left out.
          roomIds = ctx.rooms
            .filter((r) => !r.is_boss)
            .map((r) => ({ id: r.id, order: r.order, m: mastery.get(r.id) }))
            .sort((a, b) => a.m - b.m || a.order - b.order)
            .slice(0, WEAK_TOPIC_COUNT)
            .sort((a, b) => a.order - b.order)
            .map((x) => x.id)
        } else if (mode === 'daily_haunt') {
          // The Haunted Hall has no dungeon rooms: the run is made of the due items.
          roomIds = []
        } else {
          // Exam: every topic, then the Exam Warden.
          roomIds = ctx.rooms.map((r) => r.id)
        }
        scoped = {
          mode,
          floorId,
          roomIds,
          runSeed: `${dungeonId}:${floorId ?? mode}:${runCounter + 1}`,
          queue: buildQueue([]),
          wrongBefore: new Set(),
          asked: new Set(),
          firstTryCorrect: new Set(),
          retries: 0,
        }
        const pool = roomIds.flatMap((rid) => {
          const room = ctx.roomById.get(rid)
          return room ? authoredPool(ctx.questions, room.monster.question_ids) : []
        })
        scoped.queue = buildQueue(drawQuestions(pool, scoped.runSeed).map((q) => q.id))
      }
      runCounter += 1
      const id = `run-${runCounter}-${randomSuffix()}`
      const first = scoped ? (ctx.roomById.get(scoped.roomIds[0]) ?? ctx.rooms[0]) : ctx.rooms[0]
      runs.set(id, {
        dungeonId,
        playerHp: INITIAL_STATE.playerHp,
        streak: 0,
        monsterHp: new Map(ctx.rooms.map((r) => [r.id, r.monster.max_hp])),
        cleared: new Set(),
        attempts: new Map(),
        correct: 0,
        total: 0,
        score: 0,
        xp: 0,
        finished: false,
        summary: null,
        maxStreak: 0,
        finishedAt: null,
        missed: new Map(),
        scoped,
        roomStats: new Map(),
        damageTaken: 0,
        revenantsRested: 0,
      })
      const haunt = scoped?.mode === 'daily_haunt'
      return {
        id,
        dungeon_id: dungeonId,
        player_hp: INITIAL_STATE.playerHp,
        monster_hp: haunt ? 0 : first.monster.max_hp,
        current_room_id: first.id,
        ...(scoped
          ? {
              mode: scoped.mode,
              run_seed: scoped.runSeed,
              ...(haunt ? { revenants: buildDueSummary(hauntInputs()).items } : {}),
              // PROPOSED: the rooms a practice run covers (the Backend picks them).
              ...(scoped.mode === 'weak_topics' || scoped.mode === 'exam' ? { room_ids: [...scoped.roomIds] } : {}),
            }
          : {}),
      }
    },

    async submitAttempt(runId, req) {
      await wait()
      const run = getRun(runId)
      const stored = run.attempts.get(req.attempt_id)
      if (stored) return structuredClone(stored)

      const ctx = ctxFor(run.dungeonId)
      const entry = ctx.keyOf(req.question_id)
      if (!entry) throw new ApiError(422, `Unknown question: ${req.question_id}`)

      const room = ctx.roomOfQuestion.get(req.question_id)
      if (!room) throw new ApiError(422, `Question has no room: ${req.question_id}`)
      const scoped = run.scoped
      // A Daily Haunt run is made of due items only: every attempt is a review, no room monster is involved.
      const haunt = scoped?.mode === 'daily_haunt'
      const roomHp = haunt ? 0 : (run.monsterHp.get(room.id) ?? 0)
      // A due question may still be answered after its room monster is defeated (a Revenant).
      // That attempt never changes the room monster: its HP stays 0 and no damage is dealt.
      const isReview = roomHp <= 0 && reviews.isDue(req.question_id)
      if (haunt && !isReview) throw new ApiError(409, 'That memory is not due.', 'NOT_DUE')
      if (roomHp <= 0 && !isReview) throw new ApiError(409, 'Monster is already defeated')
      if (run.playerHp <= 0) throw new ApiError(409, 'Player is defeated')

      if (scoped && !haunt && scoped.mode !== 'exam' && !scoped.roomIds.includes(room.id)) {
        throw new ApiError(409, 'That question is not on this floor.', 'OUT_OF_SCOPE')
      }

      const isCorrect = req.selected_answer === entry.correct
      // Retry rule (D21, PROPOSED): answering a question missed earlier in this run is a second chance.
      const isRetry = scoped !== null && scoped.wrongBefore.has(req.question_id)
      // Real balance (C12, C13): best unlocked weapon, hard x1.25, critical x1.5 from the third answer in a row.
      // PROPOSED equip (13.7): a chosen weapon must be unlocked, as the real backend checks; absent means the best.
      const unlocked = unlockedWeapons()
      if (req.weapon_id !== undefined && !unlocked.includes(req.weapon_id)) {
        throw new ApiError(409, 'That weapon is still locked.', 'WEAPON_LOCKED')
      }
      const weapon = req.weapon_id !== undefined ? resolveWeapon(req.weapon_id) : bestWeaponAmong(unlocked)
      const critical = !isReview && isCorrect && run.streak >= CRIT_AFTER_STREAK
      const baseProfile = room.is_boss && !isReview ? BOSS_PROFILE : ROOM_PROFILE
      const strike = strikeDamage(weapon.baseDamage, ctx.hardIds.has(req.question_id), critical)
      const { next, result } = applyAnswer(
        { playerHp: run.playerHp, monsterHp: roomHp, streak: run.streak },
        isCorrect,
        {
          ...baseProfile,
          weaponDamage: isRetry ? roundHalfEven(strike * RETRY_MULTIPLIER) : strike,
          // A review in the Haunted Hall costs no health (mock rule, PROPOSED).
          wrongAnswerDamage: haunt ? 0 : baseProfile.wrongAnswerDamage,
        },
      )
      if (isRetry && result.xp_delta !== undefined) {
        result.xp_delta = roundHalfEven(result.xp_delta * RETRY_MULTIPLIER)
      }
      const full: AnswerResult = {
        ...result,
        source: { page: entry.page, chunk_id: entry.chunk_id },
        ...(entry.explanation !== undefined ? { explanation: entry.explanation } : {}),
        weapon_id: weapon.id,
        is_critical: critical,
      }
      if (scoped && !haunt) {
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
        // PROPOSED: the right answer is revealed only after a wrong one.
        if (!isCorrect) full.correct_answer = entry.correct
      }
      mastery.record(room.id, isCorrect)
      if (isCorrect) scheduled.set(req.question_id, now() + MOCK_REVIEW_INTERVAL_MS)
      else scheduled.delete(req.question_id)
      reviews.record(req.question_id, isCorrect)
      const lost = Math.max(0, run.playerHp - next.playerHp)
      run.damageTaken += lost
      if (isReview) {
        if (isCorrect) run.revenantsRested += 1
      } else {
        const rs = run.roomStats.get(room.id) ?? { correct: 0, wrong: 0, damage: 0 }
        if (isCorrect) rs.correct += 1
        else rs.wrong += 1
        rs.damage += lost
        run.roomStats.set(room.id, rs)
      }
      run.playerHp = next.playerHp
      run.streak = next.streak
      run.maxStreak = Math.max(run.maxStreak, next.streak)
      if (!isCorrect && !run.missed.has(req.question_id)) {
        const prompt = ctx.questions.find((q) => q.id === req.question_id)?.prompt ?? entry.correct
        run.missed.set(req.question_id, { text: prompt, page: entry.page })
      }
      if (!haunt) run.monsterHp.set(room.id, next.monsterHp)
      run.total += 1
      if (isCorrect) run.correct += 1
      run.score += result.score_delta
      run.xp += result.xp_delta ?? 0
      run.attempts.set(req.attempt_id, full)
      return structuredClone(full)
    },

    async clearRoom(runId, roomId) {
      await wait()
      const run = getRun(runId)
      const room = ctxFor(run.dungeonId).roomById.get(roomId)
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
      const ctx = ctxFor(run.dungeonId)
      const scoped = run.scoped
      // A floor run ends at its Floor_Boss; a Daily Haunt and the other whole-dungeon modes need no boss.
      const floorRun = scoped !== null && (scoped.mode === 'floor' || scoped.mode === 'replay_floor')
      const gateRoomId = floorRun ? scoped.roomIds[scoped.roomIds.length - 1] : scoped ? undefined : ctx.bossRoom?.id
      if (gateRoomId !== undefined && !run.cleared.has(gateRoomId)) {
        throw new ApiError(409, 'Boss has not been defeated', 'BOSS_NOT_CLEARED')
      }
      if (!run.summary) {
        run.finished = true
        const summary: RunSummary = {
          score: run.score,
          xp: run.xp,
          correct: run.correct,
          total: run.total,
          accuracy: run.total === 0 ? 0 : run.correct / run.total,
        }
        const topicRooms = (scoped ? scoped.roomIds : ctx.rooms.map((r) => r.id)).flatMap((id) => {
          const r = ctx.roomById.get(id)
          return r ? [r] : []
        })
        summary.mastery_by_topic = topicRooms.map((r) => ({
          topic_id: r.id,
          title: r.label,
          mastery: mastery.get(r.id),
        }))
        if (scoped && floorRun && scoped.floorId) {
          const rank = rankFor(firstTryAccuracy(scoped.firstTryCorrect.size, scoped.asked.size), scoped.retries)
          summary.floor_rank = rank
          const best = ranks.get(scoped.floorId)
          if (!best || RANK_VALUE[rank] > RANK_VALUE[best]) ranks.set(scoped.floorId, rank)
          summary.chest_rewards = [
            { id: 'chest-xp', kind: 'xp', label: 'Bonus XP', amount: 10 * (RANK_VALUE[rank] + 1) },
            { id: 'chest-coins', kind: 'coins', label: 'Crypt coins', amount: 15 * (RANK_VALUE[rank] + 1) },
          ]
        }
        if (scoped?.mode === 'daily_haunt') {
          const day = new Date(now()).toISOString().slice(0, 10)
          if (day !== lastHauntDay) {
            lastHauntDay = day
            dailyStreak += 1
          }
        }
        // Badges (frontend-07 Phase 7): the mock computes them; the Http_Client shows only the Backend's list.
        const practice = scoped?.mode === 'weak_topics' || scoped?.mode === 'exam' || scoped?.mode === 'daily_haunt'
        const doneRooms = clearedRooms()
        const rooms: RoomRecord[] = [...run.cleared].map((id) => {
          const rs = run.roomStats.get(id)
          return { correct: rs?.correct ?? 0, wrong: rs?.wrong ?? 0, damageTaken: rs?.damage ?? 0, cleared: true }
        })
        summary.badges_earned = evaluateBadges(
          {
            rooms,
            correct: run.correct,
            wrong: run.total - run.correct,
            damageTaken: run.damageTaken,
            bossCleared:
              (floorRun && gateRoomId !== undefined && run.cleared.has(gateRoomId)) ||
              ctx.rooms.some((r) => r.is_boss && run.cleared.has(r.id)),
            maxStreak: run.maxStreak,
            revenantsCleared: run.revenantsRested,
            allRoomsCleared: !practice && ctx.rooms.every((r) => doneRooms.has(r.id)),
          },
          { speedReader: readFlags().badgeSpeedReader },
        )
        // PROPOSED finish additions (frontend-07 Phase 5).
        const levelBefore = playerLevel(run)
        const levelAfter = playerLevel()
        summary.level_up = levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null
        const before = new Set(unlockedWeapons(run))
        const gained = unlockedWeapons().filter((id) => !before.has(id))
        summary.weapon_unlocked = gained.length > 0 ? bestWeaponAmong(gained).id : null
        summary.weak_concepts = [...run.missed.values()].slice(0, 5)
        summary.leaderboard_rank = runRankOnDemoBoard(
          { score: run.score, accuracy: summary.accuracy, bestStreak: run.maxStreak },
          sessionName,
        )
        // A signed-in player's runs are stored on the board; a guest's are not (provisional rank only).
        // A Daily Haunt is a review, not a scored dungeon run: it never reaches the board.
        if (scoped?.mode !== 'daily_haunt') {
          finishedRuns.push({
            id: `board-${runCounter}-${finishedRuns.length + 1}`,
            dungeonId: run.dungeonId,
            score: run.score,
            accuracy: summary.accuracy,
            bestStreak: run.maxStreak,
            finishedAt: now(),
          })
        }
        run.finishedAt = now()
        run.summary = summary
      }
      return structuredClone(run.summary)
    },

    async getProgress() {
      await wait()
      // Cumulative across all runs of this adapter instance (answer xp + clear xp, summed).
      const base = progressFromXp(totalXp())
      const level = options.level ?? base.level
      const unlocked = unlockedWeapons()
      return {
        ...base,
        level,
        unlocked_weapons: unlocked,
        // The weapon list the Armory reads: unlocked weapons count as level 1, the rest as the next level,
        // each with its real unlock rule.
        weapons: WEAPONS.map((w) => ({
          id: w.id,
          unlock_level: unlocked.includes(w.id) ? 1 : level + 1,
          requirement: w.requirement,
        })),
        // PROPOSED: how many reviews are due across the dungeon.
        due_review_count: reviews.count(),
        ...proposedProgress(),
        // PROPOSED (frontend-07 Phase 5): earned badges (all finished runs) and the latest runs.
        badges: earnedBadges(),
        recent_runs: [...runs.values()]
          .filter((r) => r.summary !== null)
          .reverse()
          .slice(0, 5)
          .map((r, i) => ({
            id: `recent-${i + 1}`,
            dungeon_name: demoDungeon.name,
            score: r.summary?.score ?? 0,
            accuracy: r.summary?.accuracy ?? 0,
            finished_at: new Date(r.finishedAt ?? now()).toISOString(),
          })),
      }
    },

    async getLeaderboard(query) {
      await wait()
      return buildMockLeaderboard({
        dungeonId: query.dungeonId,
        demoDungeonId: demoDungeon.id,
        period: query.period,
        limit: query.limit ?? 20,
        runs: finishedRuns,
        playerName: sessionName,
        playerLevel: playerLevel(),
        badges: earnedBadges(),
        isGuest: isGuestPlayer,
        nowMs: now(),
        updatedAt: new Date(now()).toISOString(),
      })
    },

    async getRun(runId) {
      await wait()
      const run = getRun(runId)
      const rooms = ctxFor(run.dungeonId).rooms
      const current = rooms.find((r) => !run.cleared.has(r.id)) ?? rooms[rooms.length - 1]
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

    getDueReviews: (async (dungeonId?: string) => {
      await wait()
      // Thin adapter: with a dungeon id the old bare array (HUD counter, room Revenants); without one the new shape.
      if (dungeonId === undefined) return buildDueSummary(hauntInputs())
      // A generated dungeon has no seeded reviews: misses there come back through the requeue, not as ghosts.
      if (dungeonId !== demoDungeon.id) {
        ctxFor(dungeonId)
        return []
      }
      return reviews.list(demoDungeon.questions)
    }) as ApiClient['getDueReviews'],

    async getGenerationStatus(dungeonId) {
      await wait()
      const generated = upload.generationStatus(dungeonId, playState())
      if (generated) return generated
      if (dungeonId !== demoDungeon.id) throw new ApiError(404, `Dungeon not found: ${dungeonId}`)
      return { dungeon_id: dungeonId, floors: floorView().floors.map((f) => ({ id: f.id, status: f.status })) }
    },

    uploadDocument: async (file) => {
      await wait()
      return upload.uploadDocument(file)
    },
    getDocumentStatus: async (id) => {
      await wait()
      return upload.getDocumentStatus(id)
    },
    getDocumentTopics: async (id) => {
      await wait()
      return upload.getDocumentTopics(id)
    },
    generateDungeon: async (id) => {
      await wait()
      return upload.generateDungeon(id)
    },
    retryDocument: async (id) => {
      await wait()
      return upload.retryDocument(id)
    },

    async retryFloor(floorId) {
      await wait()
      const generatedRetry = upload.retryFloor(floorId)
      if (generatedRetry === false) throw new ApiError(409, 'That floor has not failed.', 'FLOOR_NOT_FAILED')
      if (generatedRetry === true) return
      if (!DEMO_FLOOR_DEFS.some((f: FloorDef) => f.id === floorId)) {
        throw new ApiError(404, `Floor not found: ${floorId}`, 'FLOOR_NOT_FOUND')
      }
      if (forced.get(floorId) !== 'failed') throw new ApiError(409, 'That floor has not failed.', 'FLOOR_NOT_FAILED')
      forced.delete(floorId)
    },
  }
}
export const mockAdapter: ApiClient = createMockAdapter({
  level: readMockLevel(),
  player: readMockPlayer(),
  demoSessionDelayMs: readMockDelayMs(),
})
export default mockAdapter
