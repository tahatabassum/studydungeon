import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { getApi } from '@/api'
import type { ApiClient } from '@/api'
import { createGameBridge } from '@/game/events'
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

  const apiRef = useRef<ApiClient | null>(null)
  const attemptIdRef = useRef<string>('')
  const answeredRef = useRef<string[]>([])
  const stateRef = useRef(state)
  const questionRef = useRef(question)
  const gameWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    stateRef.current = state
    questionRef.current = question
  })

  const room: Room | null = dungeon?.rooms[0] ?? null

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
        dispatch({ type: 'run-started', run, maxMonsterHp: d.rooms[0].monster.max_hp })
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
    if (room) bridge.send({ type: 'load-room', room })
  }, [bridge, room])
  useEffect(() => {
    bridge.send({ type: 'set-reduced-motion', value: reducedMotion })
  }, [bridge, reducedMotion])
  useEffect(() => {
    if (room) bridge.send({ type: 'set-phase', phase: state.phase })
  }, [bridge, room, state.phase])

  // Phaser -> React events.
  useEffect(() => {
    return bridge.on((e) => {
      if (e.type === 'encounter-started') {
        if (stateRef.current.phase !== 'exploring' || !room) return
        const ids = room.monster.question_ids
        let remaining = ids.filter((id) => !answeredRef.current.includes(id))
        if (remaining.length === 0) {
          answeredRef.current = []
          remaining = ids
        }
        const q = dungeon?.questions.find((x) => x.id === remaining[0])
        if (!q) return
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
      }
    })
  }, [bridge, room, dungeon])

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
        answeredRef.current.push(q.id)
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

  const onContinue = useCallback(async () => {
    const s = stateRef.current
    dispatch({ type: 'result-settled' })
    setQuestion(null)
    setPending(false)
    if (s.phase === 'resolving' && s.playerHp > 0 && s.monsterHp <= 0 && room && apiRef.current && s.runId) {
      try {
        const res = await apiRef.current.clearRoom(s.runId, room.id)
        dispatch({ type: 'room-cleared', xpDelta: res.xp_delta })
        bridge.send({ type: 'room-cleared' })
        setClearedXp(res.xp_delta)
      } catch {
        setLoadError('The room could not be cleared. Please restart.')
      }
    } else {
      focusGame()
    }
  }, [bridge, room, focusGame])

  const restart = useCallback(async () => {
    const api = apiRef.current
    if (!api || !dungeon) return
    try {
      const run = await api.startRun(dungeon.id)
      answeredRef.current = []
      setQuestion(null)
      setPending(false)
      setAnswerError(null)
      setAnimDone(false)
      setClearedXp(null)
      dispatch({ type: 'run-started', run, maxMonsterHp: dungeon.rooms[0].monster.max_hp })
      bridge.send({ type: 'reset' })
      bridge.send({ type: 'set-phase', phase: 'exploring' })
      setTimeout(focusGame, 0)
    } catch {
      setLoadError('A new run could not be started.')
    }
  }, [bridge, dungeon, focusGame])

  const resume = useCallback(() => {
    dispatch({ type: 'resume' })
  }, [])

  // Esc toggles pause while exploring/paused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
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
