/**
 * Run_State reducer. Pure; no React import.
 * The backend (or Mock_Adapter) is authoritative: this reducer only copies
 * values from Answer_Results and never derives damage, HP or streak itself.
 */
import type { GamePhase } from '@/game/events'
import type { AnswerResult, Run } from '@/types/api'

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
  /** Phase to restore on resume; null when not paused. */
  prevPhase: Phase | null
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
  prevPhase: null,
}

export type RunAction =
  | { type: 'run-started'; run: Run; maxMonsterHp?: number }
  | { type: 'encounter-started' }
  | { type: 'result-received'; result: AnswerResult }
  | { type: 'result-settled' }
  | { type: 'room-cleared'; xpDelta: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'run-started':
      return {
        ...initialRunState,
        runId: action.run.id,
        phase: 'exploring',
        playerHp: action.run.player_hp,
        monsterHp: action.run.monster_hp,
        maxPlayerHp: action.run.player_hp,
        maxMonsterHp: action.maxMonsterHp ?? action.run.monster_hp,
      }

    case 'encounter-started':
      if (state.phase !== 'exploring') return state
      return { ...state, phase: 'encounter' }

    case 'result-received': {
      if (state.phase !== 'encounter' && state.phase !== 'resolving') return state
      const r = action.result
      return {
        ...state,
        phase: 'resolving',
        playerHp: r.player_hp_remaining,
        monsterHp: r.monster_hp_remaining,
        streak: r.streak,
        xp: state.xp + r.xp_delta,
        score: state.score + r.score_delta,
        lastResult: r,
      }
    }

    case 'result-settled':
      if (state.phase !== 'resolving') return state
      if (state.playerHp <= 0) return { ...state, phase: 'defeated' }
      if (state.monsterHp <= 0) return { ...state, phase: 'cleared' }
      return { ...state, phase: 'exploring' }

    case 'room-cleared':
      if (state.phase === 'defeated' || state.phase === 'paused') return state
      return { ...state, phase: 'cleared', xp: state.xp + action.xpDelta }

    case 'pause':
      if (state.phase !== 'exploring') return state
      return { ...state, phase: 'paused', prevPhase: state.phase }

    case 'resume':
      if (state.phase !== 'paused') return state
      return { ...state, phase: state.prevPhase ?? 'exploring', prevPhase: null }

    case 'reset':
      return initialRunState
  }
}
