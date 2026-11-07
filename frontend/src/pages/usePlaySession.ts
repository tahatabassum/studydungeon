import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '@/api'
import type { ApiClient } from '@/api'
import { createGameBridge } from '@/game/events'
import { canAnswer, canRetreat, readDelayMs } from '@/state/combatMachine'
import { pickQuestionId } from '@/state/questionSelector'
import { initialRunState, runReducer } from '@/state/runReducer'
import { useReducedMotion } from '@/state/useReducedMotion'
import { useSession } from '@/state/SessionContext'
import type { Dungeon, Question, Room } from '@/types/api'

function newAttemptId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Orchestrates dungeon loading, the run reducer, the Event_Bridge and combat flow. */
export function usePlaySession() {
  const { dungeonId } = useSession()
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
  const navigate = useNavigate()

  const apiRef = useRef<ApiClient | null>(null)
  const attemptIdRef = useRef<string>('')
  const askCountsRef = useRef<Map<string, number>>(new Map())
  const pendingClearRoomRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const clearStartedRoomsRef = useRef<Set<string>>(new Set())
  const stateRef = useRef(state)
  const questionRef = useRef(question)
  const gameWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    stateRef.current = state
    questionRef.current = question
  })

  const rooms: Room[] = dungeon ? [...dungeon.rooms].sort((a, b) => a.order - b.order) : []
  const room: Room | null = rooms.find((r) => r.id === state.currentRoomId) ?? rooms[0] ?? null

  const focusGame = useCallback(() => {
    gameWrapRef.current?.querySelector<HTMLElement>('[role="application"]')?.focus()
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
        const d = await api.getDungeon(dungeonId)
        const run = await api.startRun(d.id)
        if (cancelled) return
        apiRef.current = api
        setDungeon(d)
        dispatch({ type: 'run-started', run, rooms: d.rooms })
      } catch {
        if (!cancelled) setLoadError('The dungeon could not be loaded.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dungeonId])

  // Push data to Phaser. Effects re-run on StrictMode remount, so these are idempotent.
  useEffect(() => {
    if (dungeon) bridge.send({ type: 'load-dungeon', rooms: dungeon.rooms })
  }, [bridge, dungeon])
  useEffect(() => {
    bridge.send({ type: 'set-muted', value: muted })
  }, [bridge, muted])
  useEffect(() => {
    bridge.send({ type: 'set-reduced-motion', value: reducedMotion })
  }, [bridge, reducedMotion])
  useEffect(() => {
    if (dungeon) bridge.send({ type: 'set-phase', phase: state.phase })
  }, [bridge, dungeon, state.phase])

  // Phaser -> React events.
  useEffect(() => {
    return bridge.on((e) => {
      if (e.type === 'encounter-started') {
        const cur = stateRef.current
        if (cur.phase !== 'exploring' || (cur.combat !== null && cur.combat !== 'exited') || !dungeon) return
        const monsterRoom = dungeon.rooms.find((r) => r.monster.id === e.monsterId)
        if (!monsterRoom) return
        const count = askCountsRef.current.get(e.monsterId) ?? 0
        const qid = pickQuestionId(monsterRoom.monster.question_ids, count)
        const q = qid ? dungeon.questions.find((x) => x.id === qid) : undefined
        if (!q) {
          setLoadError('This monster has no questions to ask.')
          return
        }
        // The counter advances when a question is presented.
        askCountsRef.current.set(e.monsterId, count + 1)
        attemptIdRef.current = newAttemptId()
        setAnswerError(null)
        setAnimDone(false)
        setQuestion(q)
        dispatch({ type: 'encounter-started' })
        dispatch({ type: 'question-presented' })
      } else if (e.type === 'result-animation-done') {
        setAnimDone(true)
        dispatch({ type: 'result-settled' })
      } else if (e.type === 'pause-requested') {
        dispatch({ type: 'pause' })
      } else if (e.type === 'room-entered') {
        dispatch({ type: 'room-entered', roomId: e.roomId })
      } else if (e.type === 'gate-opened') {
        dispatch({ type: 'gate-opened', roomId: e.roomId })
      }
    })
  }, [bridge, dungeon])

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
      try {
        const result = await api.submitAttempt(runId, {
          question_id: q.id,
          selected_answer: selected,
          // Same attempt_id is reused on retry until a new question is presented.
          attempt_id: attemptIdRef.current,
        })
        setAnimDone(false)
        dispatch({ type: 'result-received', result })
        bridge.send({ type: 'apply-result', result })
      } catch {
        dispatch({ type: 'answer-failed' })
        setAnswerError('Your answer could not be submitted. Please try again.')
      } finally {
        submittingRef.current = false
      }
    },
    [bridge],
  )

  const finish = useCallback(async () => {
    const api = apiRef.current
    const runId = stateRef.current.runId
    if (!api || !runId) return
    setFinishError(null)
    try {
      const summary = await api.finishRun(runId)
      dispatch({ type: 'run-finished', summary })
    } catch {
      setFinishError('Your results could not be loaded.')
    }
  }, [])

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
        if (dungeon.rooms.find((r) => r.id === roomId)?.is_boss) await finish()
        else bridge.send({ type: 'gate-open', roomId })
      } catch {
        setClearError('The room could not be cleared. Please try again.')
      }
    },
    [bridge, dungeon, finish],
  )

  /** Leaves the current result: next question, room clear, or defeat. */
  const advanceCombat = useCallback(() => {
    const s = stateRef.current
    const c = s.combat
    if (c !== 'next' && c !== 'monster_defeated' && c !== 'player_defeated') return
    dispatch({ type: 'advance' })
    if (c === 'next') {
      const monsterRoom = dungeon?.rooms.find((r) => r.id === s.currentRoomId)
      const monsterId = monsterRoom?.monster.id
      const count = monsterId ? (askCountsRef.current.get(monsterId) ?? 0) : 0
      const qid = monsterRoom ? pickQuestionId(monsterRoom.monster.question_ids, count) : undefined
      const q = qid ? dungeon?.questions.find((x) => x.id === qid) : undefined
      if (!monsterId || !q) {
        setLoadError('This monster has no questions to ask.')
        return
      }
      askCountsRef.current.set(monsterId, count + 1)
      attemptIdRef.current = newAttemptId()
      setAnswerError(null)
      setAnimDone(false)
      setQuestion(q)
      dispatch({ type: 'question-presented' })
    } else if (c === 'monster_defeated') {
      setQuestion(null)
      const roomId = s.currentRoomId
      if (roomId && !clearStartedRoomsRef.current.has(roomId)) {
        clearStartedRoomsRef.current.add(roomId)
        void clear(roomId)
      }
    } else {
      setQuestion(null)
    }
  }, [clear, dungeon])

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

  const retryClear = useCallback(async () => {
    if (pendingClearRoomRef.current) await clear(pendingClearRoomRef.current)
  }, [clear])

  const retryFinish = useCallback(() => finish(), [finish])

  const restart = useCallback(async () => {
    const api = apiRef.current
    if (!api || !dungeon) return
    try {
      const run = await api.startRun(dungeon.id)
      askCountsRef.current = new Map()
      pendingClearRoomRef.current = null
      clearStartedRoomsRef.current = new Set()
      setQuestion(null)
      setAnswerError(null)
      setAnimDone(false)
      setClearedXp(null)
      setClearError(null)
      setFinishError(null)
      dispatch({ type: 'run-started', run, rooms: dungeon.rooms })
      bridge.send({ type: 'reset' })
      bridge.send({ type: 'set-phase', phase: 'exploring' })
      setTimeout(focusGame, 0)
    } catch {
      setLoadError('A new run could not be started.')
    }
  }, [bridge, dungeon, focusGame])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])
  const exit = useCallback(() => navigate('/'), [navigate])
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
    setQuestion(null)
    setAnswerError(null)
    setTimeout(focusGame, 0)
  }, [focusGame])

  // Esc toggles pause while exploring/paused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      // The exit confirmation owns Esc while open (it cancels back to the pause menu).
      if (document.querySelector('[role="alertdialog"]')) return
      const { phase, combat: c } = stateRef.current
      if (phase === 'paused') dispatch({ type: 'resume' })
      else if (phase === 'exploring' || (phase === 'encounter' && c === 'question')) {
        dispatch({ type: 'pause' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Return focus to the game after resuming.
  const prevPhase = useRef(state.phase)
  useEffect(() => {
    if (prevPhase.current === 'paused' && state.phase !== 'paused') focusGame()
    prevPhase.current = state.phase
  }, [state.phase, focusGame])

  const pending = state.combat === 'submitting' || state.combat === 'result'

  const session = {
    bridge,
    state,
    room,
    rooms,
    currentRoomId: state.currentRoomId,
    clearedRoomIds: state.clearedRoomIds,
    summary: state.summary,
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
    onAnswer,
    skipWait,
    restart,
    resume,
    retreat,
  }
  return [session, gameWrapRef] as const
}
