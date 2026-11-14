import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeError, getApi, supportsPracticeModes } from '@/api'
import { ambient } from '@/audio/ambient'
import { sfx } from '@/audio/sfx'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api/errors'
import { getEquippedWeapon, setEquippedWeapon } from '@/weapons/equipped'
import { entrySide } from '@/encounter/entrySide'
import { remainingDue, spawnsForRoom } from '@/encounter/revenants'
import { createGameBridge } from '@/game/events'
import { canAnswer, canRetreat, readDelayMs } from '@/state/combatMachine'
import { duePending, nextReturnIn, type PendingRequeue } from '@/state/pendingRequeue'
import { pickQuestionId } from '@/state/questionSelector'
import { comboTier, comboValue } from '@/learning/combo'
import { initialRunState, runReducer } from '@/state/runReducer'
import { useReducedMotion } from '@/state/useReducedMotion'
import { useSession } from '@/state/SessionContext'
import { recordFinishedRun } from '@/leaderboard/sessionRuns'
import { floorDungeon, practiceDungeon } from '@/campaign/floorRooms'
import { rejectionMessage } from '@/campaign/rejection'
import { buildHall, hallRoomAtRest, remainingSpawns, type Hall } from '@/haunt/hauntHall'
import { modeRequest } from '@/haunt/modes'
import type { Dungeon, DueReview, WeaponId, ProgressInfo, Question, Run, Room, RunMode, StartRunRequest } from '@/types/api'

function startRequest(dungeonId: string, floorId: string | null, mode: RunMode): StartRunRequest {
  if (mode === 'floor') return { dungeon_id: dungeonId, floor_id: floorId, mode }
  return modeRequest(mode, dungeonId, floorId ?? undefined)
}

/** The start was refused by the Backend (kept apart from a failed dungeon load). */
class StartRejected extends Error {
  constructor(readonly original: unknown) {
    super('start rejected')
  }
}
/** The Floor in the route is not in the dungeon. */
class MissingFloor extends Error {}

/** Everything a run needs to begin: the run, the dungeon the scene loads and, for a Daily Haunt, the hall. */
interface Started {
  run: Run
  dungeon: Dungeon
  hall: Hall | null
  /** Room whose clearing ends the run when no room is the boss. */
  finalRoomId?: string
  /** The whole dungeon as fetched, kept for a restart. */
  full: Dungeon | null
}

/**
 * Starts a run for the scope: loads what is needed, calls `startRun` with the body for the mode and
 * returns the pieces. `full` is passed on a restart to skip the fetch. Returns null for a Daily Haunt with nothing due.
 */
async function startPlay(
  api: ApiClient,
  dungeonId: string,
  floorId: string | null,
  mode: RunMode | null,
  full: Dungeon | null,
): Promise<Started | null> {
  if (mode === 'daily_haunt') {
    let run: Run
    try {
      run = await api.startRun(startRequest(dungeonId, null, mode))
    } catch (err) {
      throw new StartRejected(err)
    }
    // The items come with the run (mock) or from the due list (the same list the button counted).
    const items = run.revenants ?? (await api.getDueReviews()).items
    const hall = buildHall(dungeonId, items)
    if (!hall) return null
    const roomIds = hall.roomIds
    return {
      run: { ...run, current_room_id: roomIds[0], monster_hp: 0 },
      dungeon: hall.dungeon,
      hall,
      finalRoomId: roomIds[roomIds.length - 1],
      full: null,
    }
  }
  const whole = full ?? (await api.getDungeon(dungeonId))
  let dungeon: Dungeon | null = whole
  if (mode === 'floor' || mode === 'replay_floor') {
    dungeon = floorId === null ? null : floorDungeon(whole, floorId)
    if (!dungeon) throw new MissingFloor()
  }
  let run: Run
  try {
    run = await api.startRun(mode === null || dungeon === null ? dungeonId : startRequest(dungeon.id, floorId, mode))
  } catch (err) {
    // A legacy start (no scope) reports the plain error; a scoped one returns to the map with the message.
    if (mode === null) throw err
    throw new StartRejected(err)
  }
  let finalRoomId: string | undefined
  if ((mode === 'weak_topics' || mode === 'exam') && run.room_ids && run.room_ids.length > 0) {
    const picked = practiceDungeon(whole, run.room_ids)
    if (picked) {
      dungeon = picked
      finalRoomId = picked.rooms[picked.rooms.length - 1].id
    }
  }
  return { run, dungeon: dungeon ?? whole, hall: null, finalRoomId, full: whole }
}

/**
 * Picks the question to present for a room monster. A missed question whose return is due comes back first
 * (`returned` names it); otherwise the monster's rotation continues and its counter advances. The gap that
 * made the question due is the Backend's `requeue_after`; nothing here computes one.
 */
function chooseQuestion(
  dungeon: Dungeon,
  monsterRoom: Room,
  pending: readonly PendingRequeue[],
  counts: Map<string, number>,
): { q: Question | undefined; returned?: string } {
  const due = duePending(pending)
  const back = due ? dungeon.questions.find((x) => x.id === due.questionId) : undefined
  if (due && back) return { q: back, returned: due.questionId }
  const monsterId = monsterRoom.monster.id
  const count = counts.get(monsterId) ?? 0
  const qid = pickQuestionId(monsterRoom.monster.question_ids, count)
  const q = qid ? dungeon.questions.find((x) => x.id === qid) : undefined
  if (q) counts.set(monsterId, count + 1)
  return { q }
}

/** Longest the Scorecard waits for the boss death sequence (about 0.4 s to the blow plus 0.9 s), and the reduced fade. */
export const BOSS_HOLD_MS = 2000
export const BOSS_HOLD_REDUCED_MS = 700

function newAttemptId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Campaign play: only one Floor (or the Final_Boss) of the dungeon is loaded. Without a scope the
 * whole dungeon plays, as before (the legacy `/play` route).
 */
export interface PlayScope {
  dungeonId: string
  /** The Floor (or Final_Boss) to play; absent or null for modes that are not tied to one floor. */
  floorId?: string | null
  /** Default 'floor'. Practice modes and the Daily Haunt use the same play flow. */
  mode?: RunMode
}

/** What the Backend reports after a Daily Haunt: the streak and what is still due. */
export interface HauntOutcome {
  /** Null when the Backend could not be asked. */
  dailyStreak: number | null
  dueLeft: number | null
  nextDueAt: string | null
}

/** Router state a failed start leaves for the floor map. */
export interface MapLocationState {
  startError?: string
}

export function campaignPath(dungeonId: string): string {
  return `/campaign/${encodeURIComponent(dungeonId)}`
}

/** Orchestrates dungeon loading, the run reducer, the Event_Bridge and combat flow. */
export function usePlaySession(scope?: PlayScope) {
  const { dungeonId: sessionDungeonId } = useSession()
  const dungeonId = scope?.dungeonId ?? sessionDungeonId
  const floorId = scope?.floorId ?? null
  // null is the legacy whole-dungeon run (`/play`); anything else is a scoped run started with a StartRunRequest.
  const mode: RunMode | null = scope ? (scope.mode ?? 'floor') : null
  const scoped = mode !== null
  const isHaunt = mode === 'daily_haunt'
  const reducedMotion = useReducedMotion()
  const [bridge] = useState(() => createGameBridge())
  const [state, dispatch] = useReducer(runReducer, initialRunState)
  const [dungeon, setDungeon] = useState<Dungeon | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [animDone, setAnimDone] = useState(false)
  const [clearedXp, setClearedXp] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  // D26: false in real mode (the backend has no leaderboard), so the Scorecard hides the rank and the board link.
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true)
  // Haunted memories: the last due-review total fetched, Revenants rested since progress was last
  // loaded (display only), and whether the pop-up is showing a Revenant (kept through the slide-out).
  const [fetchedDue, setFetchedDue] = useState<number | null>(null)
  const [restedLocal, setRestedLocal] = useState(0)
  const [revenantView, setRevenantView] = useState(false)
  // Daily Haunt: the hall being played, the ghosts laid to rest so far, and what the Backend says after the run.
  const [hall, setHall] = useState<Hall | null>(null)
  const [hallRested, setHallRested] = useState(0)
  const [hauntOutcome, setHauntOutcome] = useState<HauntOutcome | null>(null)
  // Exam: the timer reached zero and the run was ended early.
  const [timeUp, setTimeUp] = useState(false)
  // The question on screen is a second chance (it returned after a miss, or Quick retry was used).
  const [secondChance, setSecondChance] = useState(false)
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  })

  const apiRef = useRef<ApiClient | null>(null)
  const attemptIdRef = useRef<string>('')
  const askCountsRef = useRef<Map<string, number>>(new Map())
  const pendingClearRoomRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  /** Best streak of the current run (the finish summary does not carry it); feeds the provisional rank. */
  const bestStreakRef = useRef(0)
  const clearStartedRoomsRef = useRef<Set<string>>(new Set())
  /** Due reviews behind the Revenants currently shown, by Revenant id. */
  const revenantsRef = useRef<Map<string, DueReview>>(new Map())
  const hallRef = useRef<Hall | null>(null)
  /** Revenant ids laid to rest in this Daily Haunt. */
  const restedIdsRef = useRef<Set<string>>(new Set())
  /** The hall room whose ghosts were last sent to the scene (a repeat send would reset a ghost mid-rest). */
  const spawnedHallRoomRef = useRef<string | null>(null)
  /** The whole dungeon fetched at the start, reused when a run restarts. */
  const fullDungeonRef = useRef<Dungeon | null>(null)
  const finalRoomIdRef = useRef<string | undefined>(undefined)
  const timeUpRef = useRef(false)
  const stateRef = useRef(state)
  const questionRef = useRef(question)
  const gameWrapRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  // The boss death sequence is playing: the Scorecard (and the Chest) wait for `boss-death-done`, or this timeout.
  const [bossDeathHold, setBossDeathHold] = useState(false)
  const bossHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reducedRef = useRef(reducedMotion)
  const roomsRef = useRef<Room[]>([])
  const lastTierRef = useRef(0)

  const releaseBossHold = useCallback(() => {
    if (bossHoldTimerRef.current !== null) {
      clearTimeout(bossHoldTimerRef.current)
      bossHoldTimerRef.current = null
    }
    setBossDeathHold(false)
  }, [])

  useEffect(() => {
    stateRef.current = state
    questionRef.current = question
    reducedRef.current = reducedMotion
  })
  useEffect(() => releaseBossHold, [releaseBossHold])

  // Combo aura: tell the scene the tier whenever it changes (display only; the streak is the Backend's).
  const comboNow = comboValue(state.lastResult?.combo, state.streak)
  const tierNow = comboTier(comboNow)
  useEffect(() => {
    if (tierNow === lastTierRef.current) return
    const rose = tierNow > lastTierRef.current
    lastTierRef.current = tierNow
    if (rose) sfx.play('combo')
    bridge.send({ type: 'set-combo', tier: tierNow })
  }, [bridge, tierNow])

  const rooms: Room[] = dungeon ? [...dungeon.rooms].sort((a, b) => a.order - b.order) : []
  const room: Room | null = rooms.find((r) => r.id === state.currentRoomId) ?? rooms[0] ?? null
  useEffect(() => {
    roomsRef.current = rooms
  })

  const focusGame = useCallback(() => {
    gameWrapRef.current?.querySelector<HTMLElement>('[role="application"]')?.focus()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Fetches Level/XP display data. Never throws or blocks gameplay; errors clear it. */
  const refreshProgress = useCallback(async (api: ApiClient) => {
    try {
      const p = await api.getProgress()
      if (mountedRef.current) {
        setProgress(p)
        // The backend count now includes every Revenant rested so far.
        setRestedLocal(0)
      }
    } catch {
      if (mountedRef.current) setProgress(null)
    }
  }, [])

  // Destroy the bridge on unmount. Declared first so it runs before re-sending effects on remount.
  useEffect(() => () => bridge.destroy(), [bridge])

  // Load dungeon and start a run (guarded against StrictMode double-run).
  useEffect(() => {
    if (!dungeonId) return
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        // D26: the Daily Haunt and the practice modes exist only where the backend supports them.
        if (isHaunt && api.capabilities?.dailyHaunt === false) {
          if (!cancelled) setLoadError('The Daily Haunt is coming soon. This backend cannot build it yet.')
          return
        }
        if (mode !== null && mode !== 'floor' && !isHaunt && !supportsPracticeModes(api)) {
          if (!cancelled) setLoadError('This practice mode is coming soon. This backend cannot run it yet.')
          return
        }
        let started: Started | null
        try {
          started = await startPlay(api, dungeonId, floorId, mode, null)
        } catch (err) {
          if (cancelled) return
          if (err instanceof MissingFloor) {
            navigateRef.current(campaignPath(dungeonId), {
              replace: true,
              state: { startError: 'That floor could not be found.' } satisfies MapLocationState,
            })
            return
          }
          if (err instanceof StartRejected) {
            // A locked pack opens the pack page, which explains how to unlock it.
            if (err.original instanceof ApiError && err.original.code === 'PACK_LOCKED') {
              navigateRef.current('/packs', { replace: true, state: { packLocked: err.original.message } })
              return
            }
            // A rejected start keeps the player on the map, with the Backend's message.
            navigateRef.current(campaignPath(dungeonId), {
              replace: true,
              state: {
                startError: rejectionMessage(err.original, isHaunt ? 'The Daily Haunt could not be started.' : 'The run could not be started.'),
              } satisfies MapLocationState,
            })
            return
          }
          throw err
        }
        if (cancelled) return
        if (!started) {
          setLoadError('No memories are due right now.')
          return
        }
        const { run, dungeon: d } = started
        apiRef.current = api
        fullDungeonRef.current = started.full
        finalRoomIdRef.current = started.finalRoomId
        hallRef.current = started.hall
        restedIdsRef.current = new Set()
        spawnedHallRoomRef.current = null
        if (started.hall) revenantsRef.current = new Map(started.hall.reviews.map((r) => [r.id, r]))
        setHall(started.hall)
        setHallRested(0)
        setLeaderboardEnabled(api.capabilities?.leaderboard !== false)
        setDungeon(d)
        dispatch({ type: 'run-started', run, rooms: d.rooms, finalRoomId: started.finalRoomId })
        void refreshProgress(api)
        // Real mode has no due count in progress: load it once so the Haunted counter is honest.
        // Optional: a failure hides nothing and blocks nothing.
        if (api.capabilities?.roomRevenants === false) {
          void api
            .getDueReviews()
            .then((due) => {
              if (!cancelled && mountedRef.current) setFetchedDue(due.due_count)
            })
            .catch(() => undefined)
        }
      } catch (err) {
        if (!cancelled) setLoadError(describeError(err, 'The dungeon could not be loaded.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dungeonId, floorId, mode, isHaunt, refreshProgress])

  // Push data to Phaser. Effects re-run on StrictMode remount, so these are idempotent.
  useEffect(() => {
    if (dungeon) bridge.send({ type: 'load-dungeon', rooms: dungeon.rooms })
  }, [bridge, dungeon])

  /** Daily Haunt: shows the ghosts of one hall room that are not yet at rest (once per visit to the room). */
  const sendHallSpawn = useCallback(
    (roomId: string) => {
      const h = hallRef.current
      if (!h || spawnedHallRoomRef.current === roomId) return
      spawnedHallRoomRef.current = roomId
      bridge.send({ type: 'spawn-revenants', roomId, revenants: remainingSpawns(h, roomId, restedIdsRef.current) })
    },
    [bridge],
  )
  // A new hall (start or restart) is loaded by the effect above; this runs after it, so the first hall's ghosts appear once it is built.
  useEffect(() => {
    spawnedHallRoomRef.current = null
    if (hall) sendHallSpawn(hall.roomIds[0])
  }, [hall, sendHallSpawn])
  useEffect(() => {
    bridge.send({ type: 'set-muted', value: muted })
    sfx.setMuted(muted)
    ambient.setMuted(muted)
  }, [bridge, muted])

  // Ambient bed ends when leaving the page, and on victory or defeat.
  useEffect(
    () => () => {
      ambient.setEnraged(false)
      ambient.stop()
    },
    [],
  )
  useEffect(() => {
    if (state.phase === 'victory' || state.phase === 'defeated') {
      ambient.setEnraged(false)
      ambient.stop()
    }
  }, [state.phase])

  // Audio may only start after a user gesture: unlock on the first key or pointer press.
  useEffect(() => {
    const unlock = () => {
      sfx.unlock()
      const p = stateRef.current.phase
      if (p !== 'victory' && p !== 'defeated') ambient.start()
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
    return () => {
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])
  useEffect(() => {
    bridge.send({ type: 'set-reduced-motion', value: reducedMotion })
  }, [bridge, reducedMotion])
  useEffect(() => {
    if (dungeon) bridge.send({ type: 'set-phase', phase: state.phase })
  }, [bridge, dungeon, state.phase])

  // The encounter pop-up overlays the full-viewport canvas and the camera does not move: the inset stays 0.
  useEffect(() => {
    bridge.send({ type: 'set-view-inset', bottomFraction: 0 })
  }, [bridge])

  // Phaser -> React events.
  useEffect(() => {
    return bridge.on((e) => {
      if (e.type === 'encounter-started') {
        const cur = stateRef.current
        if (cur.phase !== 'exploring' || (cur.combat !== null && cur.combat !== 'exited') || !dungeon) return
        const monsterRoom = dungeon.rooms.find((r) => r.monster.id === e.monsterId)
        if (!monsterRoom) return
        // A missed question that is due comes back first; otherwise the next one in the monster's rotation.
        const { q, returned } = chooseQuestion(dungeon, monsterRoom, cur.pendingRequeue, askCountsRef.current)
        if (!q) {
          setLoadError('This monster has no questions to ask.')
          return
        }
        if (cur.pendingRequeue.length > 0) dispatch({ type: 'requeue-presented', returned })
        setSecondChance(returned !== undefined)
        attemptIdRef.current = newAttemptId()
        setAnswerError(null)
        setAnimDone(false)
        setQuestion(q)
        setRevenantView(false)
        if (monsterRoom.is_boss) sfx.play('boss')
        dispatch({ type: 'encounter-started' })
        dispatch({ type: 'question-presented' })
        bridge.send({
          type: 'encounter-open',
          monsterId: e.monsterId,
          side: entrySide(monsterRoom.order, monsterRoom.is_boss),
        })
      } else if (e.type === 'result-animation-done') {
        setAnimDone(true)
        dispatch({ type: 'result-settled' })
      } else if (e.type === 'pause-requested') {
        dispatch({ type: 'pause' })
      } else if (e.type === 'room-entered') {
        dispatch({ type: 'room-entered', roomId: e.roomId })
        sendHallSpawn(e.roomId)
      } else if (e.type === 'gate-opened') {
        dispatch({ type: 'gate-opened', roomId: e.roomId })
      } else if (e.type === 'boss-death-done') {
        // The sequence ended: the Scorecard and the Chest may show now.
        releaseBossHold()
      } else if (e.type === 'boss-phase-changed') {
        // Enraged boss: switch the ambient bed to its enraged variant; any other phase reverts it.
        ambient.setEnraged(e.phase === 'enraged')
      } else if (e.type === 'revenant-engaged') {
        // An optional haunted-memory encounter: the same flow, with the due review's own question.
        const cur = stateRef.current
        const review = revenantsRef.current.get(e.revenantId)
        const busy = cur.phase !== 'exploring' || (cur.combat !== null && cur.combat !== 'exited') || !dungeon
        const room = review ? dungeon?.rooms.find((r) => r.id === review.room_id) : undefined
        if (busy) return
        if (!review || !room) {
          // Nothing to ask: let the scene put the ghost back.
          bridge.send({ type: 'encounter-close' })
          return
        }
        attemptIdRef.current = newAttemptId()
        setAnswerError(null)
        setAnimDone(false)
        setQuestion(review.question)
        setSecondChance(false)
        setRevenantView(true)
        dispatch({ type: 'encounter-started', revenant: true })
        dispatch({ type: 'question-presented' })
        bridge.send({ type: 'encounter-open', monsterId: e.revenantId, side: entrySide(room.order, false) })
      } else if (e.type === 'revenant-rested') {
        // The memory is at rest: forget the ghost and reload the authoritative due count.
        revenantsRef.current.delete(e.revenantId)
        if (hallRef.current) {
          restedIdsRef.current.add(e.revenantId)
          setHallRested(restedIdsRef.current.size)
        }
        const api = apiRef.current
        if (api) void refreshProgress(api)
      }
    })
  }, [bridge, dungeon, refreshProgress, releaseBossHold, sendHallSpawn])

  const onAnswer = useCallback(
    async (selected: string) => {
      const api = apiRef.current
      const q = questionRef.current
      const runId = stateRef.current.runId
      if (!api || !q || !runId) return
      if (stateRef.current.phase === 'paused') return
      if (!canAnswer(stateRef.current.combat) || submittingRef.current) return
      submittingRef.current = true
      setAnswerError(null)
      dispatch({ type: 'answer-submitted' })
      const hpBefore = stateRef.current.playerHp
      // A Revenant answer goes through the same submitAttempt path; its result never touches the monster.
      const isRevenant = stateRef.current.revenantActive
      try {
        const result = await api.submitAttempt(runId, {
          question_id: q.id,
          selected_answer: selected,
          // Same attempt_id is reused on retry until a new question is presented.
          attempt_id: attemptIdRef.current,
          // The Armory choice (13.7); absent means the best unlocked weapon.
          ...(getEquippedWeapon() ? { weapon_id: getEquippedWeapon() as WeaponId } : {}),
        })
        setAnimDone(false)
        bestStreakRef.current = Math.max(bestStreakRef.current, result.streak)
        dispatch({ type: 'result-received', result, questionId: q.id })
        // The killing blow on a boss: arm the death sequence first, then hold the Scorecard until it ends
        // (or a timeout, so a missing scene can never block the results).
        const roomNow = roomsRef.current.find((r) => r.id === stateRef.current.currentRoomId)
        if (!isRevenant && result.correct && result.monster_hp_remaining === 0 && roomNow?.is_boss === true) {
          bridge.send({ type: 'play-boss-death', roomId: roomNow.id })
          setBossDeathHold(true)
          if (bossHoldTimerRef.current !== null) clearTimeout(bossHoldTimerRef.current)
          bossHoldTimerRef.current = setTimeout(
            () => {
              bossHoldTimerRef.current = null
              setBossDeathHold(false)
            },
            reducedRef.current ? BOSS_HOLD_REDUCED_MS : BOSS_HOLD_MS,
          )
        }
        bridge.send({ type: 'apply-result', result })
        if (isRevenant && result.correct) {
          // The scene plays the soft rest chime; the displayed counter drops now and is refetched after.
          setRestedLocal((n) => n + 1)
        } else {
          // A wrong answer that costs no health is a "miss"; otherwise the wrong thud.
          sfx.play(result.correct ? 'correct' : result.player_hp_remaining >= hpBefore ? 'miss' : 'wrong')
        }
        if (!result.correct && typeof result.requeue_after === 'number') sfx.play('requeue')
        if (!result.correct && typeof result.requeue_after === 'number') sfx.play('requeue')
        if (result.player_hp_remaining <= 0) setTimeout(() => sfx.play('defeat'), 450)
      } catch (err) {
        dispatch({ type: 'answer-failed' })
        // A weapon the backend calls locked: forget the choice so the next try uses the automatic weapon.
        if (err instanceof ApiError && (err.code === 'WEAPON_LOCKED' || err.code === 'UNKNOWN_WEAPON')) setEquippedWeapon(null)
        setAnswerError(describeError(err, 'Your answer could not be submitted. Please try again.'))
      } finally {
        submittingRef.current = false
      }
    },
    [bridge],
  )

  /** Ends the run. `forced` ends it before its last room is cleared (the Exam timer reached zero). */
  const finish = useCallback(
    async (forced = false) => {
      const api = apiRef.current
      const runId = stateRef.current.runId
      if (!api || !runId) return
      setFinishError(null)
      try {
        const summary = await api.finishRun(runId)
        // After a Daily Haunt, ask the Backend for the streak: it owns that number.
        if (hallRef.current) {
          let outcome: HauntOutcome = { dailyStreak: null, dueLeft: null, nextDueAt: null }
          try {
            const due = await api.getDueReviews()
            outcome = { dailyStreak: due.daily_streak, dueLeft: due.due_count, nextDueAt: due.next_due_at }
          } catch {
            // The finale then leaves the streak out instead of guessing it.
          }
          if (mountedRef.current) setHauntOutcome(outcome)
        }
        dispatch({ type: 'run-finished', summary, forced })
        sfx.play('victory')
        // Keep the run for the provisional rank and the Dashboard stats (in memory), and refresh the XP bar.
        // A Daily Haunt is a review, not a scored run: it stays off the board.
        if (!hallRef.current) {
          recordFinishedRun({
            dungeonId: dungeonId ?? '',
            score: summary.score,
            accuracy: summary.accuracy,
            bestStreak: bestStreakRef.current,
            xp: summary.xp,
            finishedAt: Date.now(),
          })
        }
        void refreshProgress(api)
      } catch (err) {
        setFinishError(describeError(err, 'Your results could not be loaded.'))
      }
    },
    [refreshProgress, dungeonId],
  )

  /** The Exam timer reached zero: end the run now and show the results. */
  const finishExam = useCallback(() => {
    if (timeUpRef.current || stateRef.current.summary) return
    timeUpRef.current = true
    setTimeUp(true)
    void finish(true)
  }, [finish])

  /**
   * After a room is cleared: fetch the due reviews and send up to 3 Revenants for that room. Optional by
   * design: a failure is ignored and nothing here touches the clear, the gate or the run state.
   */
  const spawnRevenants = useCallback(
    async (api: ApiClient, dungeonId: string, roomId: string, runId: string) => {
      try {
        // Real backend (C19): an attempt on a cleared room is rejected, so no room Revenants spawn.
        // The counter still shows how many reviews are due, from the new summary shape.
        if (api.capabilities?.roomRevenants === false) {
          const summary = await api.getDueReviews()
          if (!mountedRef.current || stateRef.current.runId !== runId) return
          setFetchedDue(summary.due_count)
          return
        }
        // Room Revenants (mock only) need every due item with its room. This is the one place the thin
        // bare-array adapter stays: the summary caps its items for the Daily Haunt.
        const due = await api.getDueReviews(dungeonId)
        // Ignore a late answer from before a restart or after leaving the page.
        if (!mountedRef.current || stateRef.current.runId !== runId) return
        const spawns = spawnsForRoom(due, roomId)
        const ids = new Set(spawns.map((s) => s.id))
        revenantsRef.current = new Map(due.filter((d) => ids.has(d.id)).map((d) => [d.id, d]))
        setFetchedDue(due.length)
        bridge.send({ type: 'spawn-revenants', roomId, revenants: spawns })
      } catch {
        // No Revenants this time.
      }
    },
    [bridge],
  )

  const clear = useCallback(
    async (roomId: string) => {
      const api = apiRef.current
      const runId = stateRef.current.runId
      if (!api || !runId || !dungeon) return
      pendingClearRoomRef.current = roomId
      setClearError(null)
      try {
        const res = await api.clearRoom(runId, roomId)
        pendingClearRoomRef.current = null
        dispatch({ type: 'room-cleared', roomId, xpDelta: res.xp_delta })
        setClearedXp(res.xp_delta)
        void refreshProgress(api)
        // The last room of the run (the boss, or the last topic of a Weak Topics run) ends it.
        if (stateRef.current.bossRoomId === roomId) await finish()
        else {
          bridge.send({ type: 'gate-open', roomId })
          // A small reward moment as the gate opens (coins and soul gems at the player).
          bridge.send({ type: 'loot-burst' })
          void spawnRevenants(api, dungeon.id, roomId, runId)
        }
      } catch (err) {
        setClearError(describeError(err, 'The room could not be cleared. Please try again.'))
      }
    },
    [bridge, dungeon, finish, refreshProgress, spawnRevenants],
  )

  /** Leaves the current result: next question, room clear, or defeat. */
  const advanceCombat = useCallback(() => {
    const s = stateRef.current
    const c = s.combat
    if (c !== 'next' && c !== 'monster_defeated' && c !== 'player_defeated') return
    if (c === 'next' && s.revenantActive) {
      // A Revenant asks one question. Leave it: the room monster, the gate and the cleared rooms stay as they are.
      dispatch({ type: 'revenant-finished' })
      setQuestion(null)
      bridge.send({ type: 'encounter-close' })
      setTimeout(focusGame, 0)
      // Haunted Hall: when the last ghost of a hall is at rest, that hall is cleared. Its gate opens, or
      // (in the last hall) the Daily Haunt ends. No server clear: the hall rooms exist only on screen.
      const h = hallRef.current
      const hallId = s.currentRoomId
      if (h && hallId && hallRoomAtRest(h, hallId, restedIdsRef.current) && !clearStartedRoomsRef.current.has(hallId)) {
        clearStartedRoomsRef.current.add(hallId)
        dispatch({ type: 'room-cleared', roomId: hallId, xpDelta: 0 })
        if (hallId === h.roomIds[h.roomIds.length - 1]) void finish()
        else bridge.send({ type: 'gate-open', roomId: hallId })
      }
      return
    }
    dispatch({ type: 'advance' })
    if (c === 'next') {
      const monsterRoom = dungeon?.rooms.find((r) => r.id === s.currentRoomId)
      const { q, returned } =
        dungeon && monsterRoom
          ? chooseQuestion(dungeon, monsterRoom, s.pendingRequeue, askCountsRef.current)
          : { q: undefined, returned: undefined }
      if (!q) {
        setLoadError('This monster has no questions to ask.')
        return
      }
      // Counts one more question toward every waiting return (the gap itself is the Backend's).
      if (s.pendingRequeue.length > 0) dispatch({ type: 'requeue-presented', returned })
      setSecondChance(returned !== undefined)
      attemptIdRef.current = newAttemptId()
      setAnswerError(null)
      setAnimDone(false)
      setQuestion(q)
      dispatch({ type: 'question-presented' })
    } else if (c === 'monster_defeated') {
      setQuestion(null)
      bridge.send({ type: 'encounter-close' })
      const roomId = s.currentRoomId
      if (roomId && !clearStartedRoomsRef.current.has(roomId)) {
        clearStartedRoomsRef.current.add(roomId)
        void clear(roomId)
      }
    } else {
      setQuestion(null)
      bridge.send({ type: 'encounter-close' })
    }
  }, [bridge, clear, dungeon, finish, focusGame])

  const advanceRef = useRef(advanceCombat)
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    advanceRef.current = advanceCombat
  })

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current !== null) {
      clearTimeout(waitTimerRef.current)
      waitTimerRef.current = null
    }
  }, [])

  // Auto-advance after the read delay while a result is being shown.
  const combat = state.combat
  const lastCorrect = state.lastResult?.correct ?? true
  useEffect(() => {
    if (combat !== 'next' && combat !== 'monster_defeated' && combat !== 'player_defeated') return
    // A wrong answer opens the Memory scroll: the player reads it and chooses Quick retry or Continue.
    if (combat === 'next' && !lastCorrect) return
    waitTimerRef.current = setTimeout(() => {
      waitTimerRef.current = null
      advanceRef.current()
    }, readDelayMs(lastCorrect))
    return clearWaitTimer
  }, [combat, lastCorrect, clearWaitTimer])

  /** Skips the read delay (Next button / Enter). No-op outside a waiting state. */
  const skipWait = useCallback(() => {
    const c = stateRef.current.combat
    if (c !== 'next' && c !== 'monster_defeated' && c !== 'player_defeated') return
    clearWaitTimer()
    advanceRef.current()
  }, [clearWaitTimer])

  /** Memory scroll, Quick retry: the same question again, right now, as a second chance. */
  const quickRetry = useCallback(() => {
    const s = stateRef.current
    const q = questionRef.current
    if (s.combat !== 'next' || !q) return
    clearWaitTimer()
    // The question is being asked now, so it no longer waits for its turn.
    dispatch({ type: 'requeue-cancel', questionId: q.id })
    dispatch({ type: 'advance' })
    attemptIdRef.current = newAttemptId()
    setAnswerError(null)
    setAnimDone(false)
    setSecondChance(true)
    dispatch({ type: 'question-presented' })
  }, [clearWaitTimer])

  const retryClear = useCallback(async () => {
    if (pendingClearRoomRef.current) await clear(pendingClearRoomRef.current)
  }, [clear])

  const retryFinish = useCallback(() => finish(timeUpRef.current), [finish])

  const restart = useCallback(async () => {
    const api = apiRef.current
    if (!api || !dungeon) return
    try {
      // A practice run is started again from scratch (the Backend may pick other topics); a Floor keeps its rooms.
      const started =
        mode === null || mode === 'floor' || mode === 'replay_floor'
          ? null
          : await startPlay(api, dungeon.id, floorId, mode, fullDungeonRef.current)
      if (mode === 'daily_haunt' && !started) {
        setLoadError('No memories are due right now.')
        return
      }
      const run = started
        ? started.run
        : await api.startRun(mode === null ? dungeon.id : startRequest(dungeon.id, floorId, mode))
      const rooms = started ? started.dungeon.rooms : dungeon.rooms
      askCountsRef.current = new Map()
      bestStreakRef.current = 0
      pendingClearRoomRef.current = null
      clearStartedRoomsRef.current = new Set()
      revenantsRef.current = new Map()
      restedIdsRef.current = new Set()
      spawnedHallRoomRef.current = null
      timeUpRef.current = false
      releaseBossHold()
      setTimeUp(false)
      setHauntOutcome(null)
      setHallRested(0)
      setRestedLocal(0)
      setRevenantView(false)
      setSecondChance(false)
      setQuestion(null)
      setAnswerError(null)
      setAnimDone(false)
      setClearedXp(null)
      setClearError(null)
      setFinishError(null)
      if (started) {
        finalRoomIdRef.current = started.finalRoomId
        hallRef.current = started.hall
        if (started.hall) revenantsRef.current = new Map(started.hall.reviews.map((r) => [r.id, r]))
        setHall(started.hall)
        setDungeon(started.dungeon)
      }
      dispatch({ type: 'run-started', run, rooms, finalRoomId: finalRoomIdRef.current })
      void refreshProgress(api)
      if (sfx.unlocked) ambient.start()
      bridge.send({ type: 'encounter-close' })
      // A practice or Haunt restart loads its rooms through the new dungeon; a floor restart rebuilds the same ones.
      if (!started) bridge.send({ type: 'reset' })
      bridge.send({ type: 'set-view-inset', bottomFraction: 0 })
      bridge.send({ type: 'set-phase', phase: 'exploring' })
      setTimeout(focusGame, 0)
    } catch (err) {
      setLoadError(describeError(err, 'A new run could not be started.'))
    }
  }, [bridge, dungeon, floorId, mode, focusGame, refreshProgress, releaseBossHold])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])
  // Campaign play returns to the map (which refetches the dungeon); the legacy route goes to the title.
  const exit = useCallback(
    () => navigate(scoped && dungeonId ? campaignPath(dungeonId) : '/'),
    [navigate, scoped, dungeonId],
  )
  const resume = useCallback(() => {
    dispatch({ type: 'resume' })
  }, [])

  /** Abandons the current encounter (only from an unanswered question). Monster HP is kept. */
  const retreat = useCallback(() => {
    const cur = stateRef.current
    if (!canRetreat(cur.combat)) return
    // Paused-from-question: resume first so the final phase is 'exploring'.
    if (cur.phase === 'paused') dispatch({ type: 'resume' })
    dispatch({ type: 'retreat' })
    setSecondChance(false)
    setQuestion(null)
    setAnswerError(null)
    bridge.send({ type: 'encounter-close' })
    setTimeout(focusGame, 0)
  }, [bridge, focusGame])

  // Esc and the HUD Pause button toggle pause while exploring/paused.
  const togglePause = useCallback(() => {
    // The exit confirmation owns Esc while open (it cancels back to the pause menu).
    if (document.querySelector('[role="alertdialog"]')) return
    const { phase, combat: c } = stateRef.current
    if (phase === 'paused') dispatch({ type: 'resume' })
    else if (phase === 'exploring' || (phase === 'encounter' && c === 'question')) {
      dispatch({ type: 'pause' })
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePause])

  // Return focus to the game after resuming.
  const prevPhase = useRef(state.phase)
  useEffect(() => {
    if (prevPhase.current === 'paused' && state.phase !== 'paused') focusGame()
    prevPhase.current = state.phase
  }, [state.phase, focusGame])

  const pending = state.combat === 'submitting' || state.combat === 'result'

  // Campaign play: what the victory overlay and the pause menu say about the Floor being played.
  const floorMeta = dungeon && floorId ? dungeon.floors?.find((f) => f.id === floorId) : undefined
  const floorTitle = floorMeta ? `Floor ${floorMeta.index}, ${floorMeta.title}` : (dungeon?.final_boss?.name ?? 'The final boss')
  const bossName = rooms[rooms.length - 1]?.monster.name ?? 'The boss'
  const isFinal = dungeon?.final_boss?.id === floorId
  const campaign = !scoped
    ? null
    : mode === 'weak_topics'
      ? {
          unit: 'practice run',
          floorTitle: 'Weak Topics',
          bossName,
          isFinal: false,
          scorecard: { title: 'Weak topics practiced', subtitle: 'Your lowest topics, one more pass', playAgainLabel: 'Practice again' },
        }
      : mode === 'exam'
        ? {
            unit: 'exam',
            floorTitle: 'Exam',
            bossName,
            isFinal: false,
            scorecard: {
              title: timeUp ? 'Time is up' : 'Exam complete',
              subtitle: timeUp ? 'The exam ended when the timer reached zero' : 'Every topic and the final boss',
              playAgainLabel: 'Take the exam again',
            },
          }
        : mode === 'daily_haunt'
          ? {
              unit: 'Daily Haunt',
              floorTitle: 'Daily Haunt',
              bossName,
              isFinal: false,
              scorecard: { title: 'Memories laid to rest', subtitle: 'Daily Haunt', playAgainLabel: 'Back to the hall' },
            }
          : {
              unit: 'floor',
              floorTitle,
              bossName,
              isFinal,
              scorecard: {
                title: mode === 'replay_floor' ? `${bossName} falls again!` : `${bossName} falls!`,
                subtitle: isFinal ? 'Dungeon cleared' : mode === 'replay_floor' ? `${floorTitle} replayed` : `${floorTitle} cleared`,
                playAgainLabel: 'Replay floor',
              },
            }

  const session = {
    campaign,
    bridge,
    state,
    room,
    rooms,
    currentRoomId: state.currentRoomId,
    clearedRoomIds: state.clearedRoomIds,
    summary: state.summary,
    /** Name of the loaded dungeon, for the share card. */
    dungeonName: dungeon?.name,
    muted,
    toggleMute,
    exit,
    clearError,
    finishError,
    retryClear,
    retryFinish,
    playAgain: restart,
    loadError,
    loading: !loadError && !room,
    question,
    pending,
    answerError,
    animDone,
    clearedXp,
    /** The boss death sequence is playing; the Scorecard and the Chest wait for it. */
    bossDeathHold,
    /** The Backend combo from the last answer; the Combo_Meter falls back to the streak. */
    combo: state.lastResult?.combo,
    progress,
    leaderboardEnabled,
    revenantView,
    secondChance,
    /** Further questions until a missed one returns (the Backend's gap, counted down); null when none waits. */
    requeueRemaining: nextReturnIn(state.pendingRequeue),
    quickRetry,
    // Haunted memories due, once progress has loaded: the backend count minus Revenants rested since.
    // In the Haunted Hall it counts the ghosts of this visit that are still waiting.
    hauntedDue: hall
      ? remainingDue(hall.total, hallRested)
      : progress
        ? remainingDue(progress.due_review_count ?? fetchedDue ?? 0, restedLocal)
        : undefined,
    hall,
    hauntOutcome,
    timeUp,
    finishExam,
    /** Backend count of memories laid to rest in this visit (Daily Haunt); the finale reads the summary. */
    hallRested,
    onAnswer,
    skipWait,
    restart,
    resume,
    togglePause,
    retreat,
  }
  return [session, gameWrapRef] as const
}
