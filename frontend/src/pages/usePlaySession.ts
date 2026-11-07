import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '@/api'
import type { ApiClient } from '@/api'
import { createGameBridge } from '@/game/events'
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
  const [pending, setPending] = useState(false)
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
        if (stateRef.current.phase !== 'exploring' || !dungeon) return
        const monsterRoom = dungeon.rooms.find((r) => r.monster.id === e.monsterId)
        if (!monsterRoom) return
        const count = askCountsRef.current.get(e.monsterId) ?? 0
        const qid = pickQuestionId(monsterRoom.monster.question_ids, count)
        const q = qid ? dungeon.questions.find((x) => x.id === qid) : undefined
        if (!q) {
          setLoadError('This monster has no questions to ask.')
          return
        }
        askCountsRef.current.set(e.monsterId, count + 1)
        attemptIdRef.current = newAttemptId()
        setAnswerError(null)
        setPending(false)
        setAnimDone(false)
        setQuestion(q)
        dispatch({ type: 'encounter-started' })
      } else if (e.type === 'result-animation-done') {
        setAnimDone(true)
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
      setPending(true)
      setAnswerError(null)
      try {
        const result = await api.submitAttempt(runId, {
          question_id: q.id,
          selected_answer: selected,
          attempt_id: attemptIdRef.current,
        })
        setAnimDone(false)
        dispatch({ type: 'result-received', result })
        bridge.send({ type: 'apply-result', result })
        // pending stays true until the animation completes, keeping options locked.
      } catch {
        setPending(false)
        setAnswerError('Your answer could not be submitted. Please try again.')
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

  const onContinue = useCallback(async () => {
    const s = stateRef.current
    dispatch({ type: 'result-settled' })
    setQuestion(null)
    setPending(false)
    if (s.phase === 'resolving' && s.playerHp > 0 && s.monsterHp <= 0 && s.currentRoomId) {
      await clear(s.currentRoomId)
    } else {
      focusGame()
    }
  }, [clear, focusGame])

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
      setQuestion(null)
      setPending(false)
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

  // Esc toggles pause while exploring/paused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      // The exit confirmation owns Esc while open (it cancels back to the pause menu).
      if (document.querySelector('[role="alertdialog"]')) return
      const phase = stateRef.current.phase
      if (phase === 'exploring') dispatch({ type: 'pause' })
      else if (phase === 'paused') dispatch({ type: 'resume' })
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
    onContinue,
    restart,
    resume,
  }
  return [session, gameWrapRef] as const
}
