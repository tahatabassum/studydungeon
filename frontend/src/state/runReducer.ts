/**
 * Run_State reducer. Pure; no React import.
 * The backend (or Mock_Adapter) is authoritative: this reducer only copies
 * values from Answer_Results and never derives damage, HP or streak itself.
 */
import type { GamePhase } from '@/game/events'
import type { AnswerResult, Run, RunSummary } from '@/types/api'
import type { CombatState } from './combatMachine'
import { addPending, removePending, tickPending, type PendingRequeue } from './pendingRequeue'

/** Minimal room shape the reducer needs; the full Room type is assignable to it. */
export interface RoomInfo {
  id: string
  order?: number
  is_boss?: boolean
  monster: { max_hp: number }
}
type RunInfo = Run & { current_room_id?: string }

/** Room id used when run-started carries no room list (legacy single-room flow). */
export const SINGLE_ROOM_ID = 'room-1'

export type Phase = GamePhase

export interface RunState {
  runId: string | null
  phase: Phase
  playerHp: number
  monsterHp: number
  maxPlayerHp: number
  maxMonsterHp: number
  xp: number
  score: number
  streak: number
  lastResult: AnswerResult | null
  /** Combat sub-state of the current encounter; null while exploring. */
  combat: CombatState | null
  /** Player HP before the latest result (display only). */
  prevPlayerHp: number
  /** Phase to restore on resume; null when not paused. */
  prevPhase: Phase | null
  currentRoomId: string | null
  /** Room ids by ascending order. */
  roomOrder: string[]
  bossRoomId: string | null
  /** Remembered monster HP per room (copied from backend values). */
  roomHp: Record<string, number>
  roomMaxHp: Record<string, number>
  clearedRoomIds: string[]
  summary: RunSummary | null
  /**
   * True while the open encounter is a Revenant (a haunted memory), not the room monster.
   * A Revenant result updates the player's HP, streak, XP and score but never the room monster's HP.
   */
  revenantActive: boolean
  /**
   * Missed questions that return after the gap the Backend gave (`requeue_after`). Display bookkeeping only.
   * They live inside the room they were missed in: clearing the room or entering another one drops them
   * (the room monster is gone, so there is nothing left to ask them with).
   */
  pendingRequeue: PendingRequeue[]
}

export const initialRunState: RunState = {
  runId: null,
  phase: 'exploring',
  playerHp: 0,
  monsterHp: 0,
  maxPlayerHp: 0,
  maxMonsterHp: 0,
  xp: 0,
  score: 0,
  streak: 0,
  lastResult: null,
  combat: null,
  prevPlayerHp: 0,
  prevPhase: null,
  currentRoomId: null,
  roomOrder: [],
  bossRoomId: null,
  roomHp: {},
  roomMaxHp: {},
  clearedRoomIds: [],
  summary: null,
  revenantActive: false,
  pendingRequeue: [],
}

export type RunAction =
  /** Without 
ooms (legacy), a single room is assumed and maxMonsterHp is used. */
  | {
      type: 'run-started'
      run: RunInfo
      rooms?: readonly RoomInfo[]
      maxMonsterHp?: number
      /** The room whose clearing ends the run when no room is flagged as the boss (the Haunted Hall's last hall). */
      finalRoomId?: string
    }
  | { type: 'room-entered'; roomId: string }
  /** `revenant` marks an optional haunted-memory encounter that must not touch the room monster. */
  | { type: 'encounter-started'; revenant?: boolean }
  /** A Revenant encounter ended after its result: back to exploring, room monster state unchanged. */
  | { type: 'revenant-finished' }
  | { type: 'question-presented' }
  | { type: 'answer-submitted' }
  | { type: 'answer-failed' }
  | { type: 'advance' }
  | { type: 'retreat' }
  /** `questionId` lets a `requeue_after` in the result be tracked against the question that was missed. */
  | { type: 'result-received'; result: AnswerResult; questionId?: string }
  /** An ordinary question was presented (or `returned`, the requeued one): the others come one question closer. */
  | { type: 'requeue-presented'; returned?: string }
  /** The question is being retried right now (Quick retry): it no longer waits for its turn. */
  | { type: 'requeue-cancel'; questionId: string }
  | { type: 'result-settled' }
  /** 
oomId defaults to the current room. */
  | { type: 'room-cleared'; roomId?: string; xpDelta: number }
  | { type: 'gate-opened'; roomId?: string }
  /** `forced` ends the run before its last room is cleared (the Exam timer reaching zero). */
  | { type: 'run-finished'; summary: RunSummary; forced?: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }

function startRun(action: Extract<RunAction, { type: 'run-started' }>): RunState {
  const { run } = action
  const sorted = [...(action.rooms ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const roomOrder = sorted.length > 0 ? sorted.map((r) => r.id) : [run.current_room_id ?? SINGLE_ROOM_ID]
  const roomMaxHp: Record<string, number> = {}
  if (sorted.length > 0) for (const r of sorted) roomMaxHp[r.id] = r.monster.max_hp
  else roomMaxHp[roomOrder[0]] = action.maxMonsterHp ?? run.monster_hp
  const roomHp = { ...roomMaxHp }
  const currentRoomId = run.current_room_id ?? roomOrder[0]
  roomHp[currentRoomId] = run.monster_hp
  roomMaxHp[currentRoomId] ??= run.monster_hp
  return {
    ...initialRunState,
    runId: run.id,
    phase: 'exploring',
    playerHp: run.player_hp,
    monsterHp: run.monster_hp,
    maxPlayerHp: run.player_hp,
    maxMonsterHp: roomMaxHp[currentRoomId],
    currentRoomId,
    roomOrder,
    bossRoomId: sorted.find((r) => r.is_boss)?.id ?? action.finalRoomId ?? null,
    roomHp,
    roomMaxHp,
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'run-started':
      return startRun(action)

    case 'room-entered': {
      const id = action.roomId
      const idx = state.roomOrder.indexOf(id)
      if (idx < 0 || state.phase === 'defeated' || state.phase === 'victory') return state
      if (id === state.currentRoomId) return state
      if (idx > 0 && !state.clearedRoomIds.includes(state.roomOrder[idx - 1])) return state
      return {
        ...state,
        currentRoomId: id,
        monsterHp: state.roomHp[id] ?? 0,
        maxMonsterHp: state.roomMaxHp[id] ?? 0,
        pendingRequeue: [],
      }
    }

    case 'encounter-started':
      if (state.phase !== 'exploring') return state
      if (state.combat !== null && state.combat !== 'exited') return state
      return { ...state, phase: 'encounter', combat: 'starting', revenantActive: action.revenant === true }

    case 'revenant-finished':
      // Only from a settled Revenant result; the room monster's HP and the cleared rooms are untouched.
      if (!state.revenantActive || state.combat !== 'next') return state
      return { ...state, phase: 'exploring', combat: null, revenantActive: false }

    case 'question-presented':
      if (state.combat !== 'starting' && state.combat !== 'next') return state
      return { ...state, phase: 'encounter', combat: 'question' }

    case 'answer-submitted':
      if (state.combat !== 'question') return state
      return { ...state, combat: 'submitting' }

    case 'answer-failed':
      if (state.combat !== 'submitting') return state
      return { ...state, combat: 'question' }

    case 'advance':
      if (state.combat === 'next') return { ...state, phase: 'encounter', combat: 'question' }
      if (state.combat === 'monster_defeated') return { ...state, phase: 'cleared', combat: null }
      if (state.combat === 'player_defeated') return { ...state, phase: 'defeated', combat: null, revenantActive: false }
      return state

    case 'retreat':
      if (state.combat !== 'question') return state
      return { ...state, phase: 'exploring', combat: 'exited', revenantActive: false }

    case 'result-received': {
      if (state.combat !== 'submitting') return state
      const r = action.result
      // The gap is the Backend's: copy it, never compute one. A Revenant is a review, not a room question.
      let pendingRequeue = state.pendingRequeue
      if (!state.revenantActive && action.questionId) {
        pendingRequeue = removePending(pendingRequeue, action.questionId)
        if (!r.correct && typeof r.requeue_after === 'number') {
          pendingRequeue = addPending(pendingRequeue, action.questionId, r.requeue_after)
        }
      }
      if (state.revenantActive) {
        // A Revenant result: copy the player-side values only. The room monster keeps its HP (0).
        return {
          ...state,
          phase: 'resolving',
          combat: 'result',
          prevPlayerHp: state.playerHp,
          playerHp: r.player_hp_remaining,
          streak: r.streak,
          xp: state.xp + (r.xp_delta ?? 0),
          score: state.score + r.score_delta,
          lastResult: r,
        }
      }
      return {
        ...state,
        phase: 'resolving',
        combat: 'result',
        prevPlayerHp: state.playerHp,
        playerHp: r.player_hp_remaining,
        monsterHp: r.monster_hp_remaining,
        streak: r.streak,
        xp: state.xp + (r.xp_delta ?? 0),
        score: state.score + r.score_delta,
        lastResult: r,
        pendingRequeue,
        roomHp: state.currentRoomId
          ? { ...state.roomHp, [state.currentRoomId]: r.monster_hp_remaining }
          : state.roomHp,
      }
    }

    case 'result-settled':
      if (state.combat !== 'result') return state
      if (state.playerHp <= 0) return { ...state, combat: 'player_defeated' }
      // The room monster is already defeated during a Revenant encounter; that must not read as a new defeat.
      if (state.monsterHp <= 0 && !state.revenantActive) return { ...state, combat: 'monster_defeated' }
      return { ...state, combat: 'next' }

    case 'requeue-presented':
      return { ...state, pendingRequeue: tickPending(state.pendingRequeue, action.returned) }

    case 'requeue-cancel':
      return { ...state, pendingRequeue: removePending(state.pendingRequeue, action.questionId) }

    case 'room-cleared': {
      if (state.phase === 'defeated' || state.phase === 'paused' || state.phase === 'victory') return state
      const id = action.roomId ?? state.currentRoomId
      if (!id || state.roomHp[id] !== 0) return state
      if (state.clearedRoomIds.includes(id)) return state
      return {
        ...state,
        phase: 'cleared',
        combat: null,
        xp: state.xp + action.xpDelta,
        clearedRoomIds: [...state.clearedRoomIds, id],
        pendingRequeue: [],
      }
    }

    case 'gate-opened':
      if (state.phase !== 'cleared') return state
      return { ...state, phase: 'exploring' }

    case 'run-finished':
      if (action.forced === true) {
        if (state.summary) return state
        return { ...state, summary: action.summary, phase: 'victory', prevPhase: null, combat: null, revenantActive: false }
      }
      if (!state.bossRoomId || !state.clearedRoomIds.includes(state.bossRoomId)) return state
      return { ...state, summary: action.summary, phase: 'victory', prevPhase: null }

    case 'pause':
      if (state.phase !== 'exploring' && !(state.phase === 'encounter' && state.combat === 'question')) return state
      return { ...state, phase: 'paused', prevPhase: state.phase }

    case 'resume':
      if (state.phase !== 'paused') return state
      return { ...state, phase: state.prevPhase ?? 'exploring', prevPhase: null }

    case 'reset':
      return initialRunState
  }
}