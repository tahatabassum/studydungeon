/**
 * Event_Bridge: the only coupling between React and Phaser.
 * Pure TypeScript, no Phaser import. Phaser code never computes game outcomes;
 * it only displays AnswerResult values it is sent.
 */
import type { AnswerResult, Room } from '@/types/api'
import type { BossPhase } from './bossPhase'

export type GamePhase =
  | 'exploring'
  | 'encounter'
  | 'resolving'
  | 'cleared'
  | 'defeated'
  | 'paused'
  | 'victory'

/**
 * One Revenant (a haunted memory) to show in a room. Defined here, not imported from the API, so
 * Phaser keeps its import boundary. `id` is the due-review id; `x` is an optional room-relative hint.
 */
export interface RevenantSpawn {
  id: string
  questionId: string
  x?: number
}

export type ToGameEvent =
  | { type: 'load-dungeon'; rooms: Room[] }
  | { type: 'set-phase'; phase: GamePhase }
  | { type: 'apply-result'; result: AnswerResult }
  | { type: 'gate-open'; roomId: string }
  | { type: 'reset' }
  | { type: 'set-reduced-motion'; value: boolean }
  | { type: 'set-muted'; value: boolean }
  /**
   * Display-only: shifts the camera so the player/monster stay visible above
   * the docked question panel. No gameplay effect.
   */
  | { type: 'set-view-inset'; bottomFraction: number }
  /** Display-only: the shell's measured stage size in CSS pixels (drives camera zoom). */
  | { type: 'set-viewport'; width: number; height: number }
  /** Display-only: the encounter pop-up opened for this monster; Phaser dims and acknowledges it. */
  | { type: 'encounter-open'; monsterId: string; side: 'left' | 'right' }
  /** Display-only: the encounter pop-up closed (retreat, monster defeated or player defeated). */
  | { type: 'encounter-close' }
  /**
   * Additive, display-only: Revenants for a room. Shown only once that room's monster is defeated,
   * at most 3, and never block the gate. An empty list clears any shown Revenants.
   */
  | { type: 'spawn-revenants'; roomId: string; revenants: RevenantSpawn[] }
  /** Additive, display-only: the combo tier (0 to 4) from the Backend streak; Phaser tints the player aura. */
  | { type: 'set-combo'; tier: 0 | 1 | 2 | 3 | 4 }
  /**
   * Additive, display-only: the boss in this room was just defeated. The scene plays the death sequence
   * when the killing blow lands and answers with `boss-death-done`.
   */
  | { type: 'play-boss-death'; roomId: string }
  /** Additive, display-only: a burst of coins or soul gems (at a world position, else at the player). */
  | { type: 'loot-burst'; x?: number; y?: number }
  /**
   * Additive (touch play): the virtual joystick vector, each axis in -1..1 and its length at most 1.
   * Sent only when it changes; (0, 0) on release, cancel and blur. The keyboard wins when a key is down.
   */
  | { type: 'set-move-input'; x: number; y: number }
  /** Additive (touch play): the Engage button was pressed. Handled exactly like E or Space. */
  | { type: 'engage-request' }
  /** Additive, display-only: touch controls are active, so in-world prompts use touch wording. */
  | { type: 'set-touch-mode'; value: boolean }

export type FromGameEvent =
  | { type: 'ready' }
  | { type: 'encounter-started'; monsterId: string }
  | { type: 'result-animation-done' }
  | { type: 'pause-requested' }
  | { type: 'room-entered'; roomId: string }
  | { type: 'gate-opened'; roomId: string }
  /** Additive, display-only: the boss phase derived from HP changed (React switches the ambient bed). */
  | { type: 'boss-phase-changed'; phase: BossPhase }
  /** Additive: the player engaged a Revenant (React opens the same encounter with its question). */
  | { type: 'revenant-engaged'; revenantId: string }
  /** Additive: a Revenant was laid to rest after a correct answer (the "memory laid to rest" effect played). */
  | { type: 'revenant-rested'; revenantId: string }
  /** Additive: the boss death sequence ended (React then shows the Scorecard and the Chest). */
  | { type: 'boss-death-done'; roomId: string }
  /**
   * Additive: whether the player can engage something right now (a monster or a Revenant in range).
   * Emitted only when the target changes. `name` is the monster's name for kind 'monster'.
   */
  | { type: 'engage-available'; kind: 'monster' | 'revenant' | null; name?: string }

export interface GameBridge {
  /** React side: send an event to the game. Queued until the game is ready. */
  send(e: ToGameEvent): void
  /** React side: listen to game events. Returns an unsubscribe function. */
  on(handler: (e: FromGameEvent) => void): () => void
  /** Game side: listen to React events. Registering flushes the queue if ready. */
  onToGame(handler: (e: ToGameEvent) => void): () => void
  /** Game side: emit an event to React. Emitting 'ready' also marks ready. */
  emit(e: FromGameEvent): void
  /** Game side: mark ready and flush queued events in order. */
  markReady(): void
  /** Clear handlers and queue. */
  destroy(): void
}

export function createGameBridge(): GameBridge {
  const fromGame = new Set<(e: FromGameEvent) => void>()
  const toGame = new Set<(e: ToGameEvent) => void>()
  let queue: ToGameEvent[] = []
  let ready = false

  function dispatch(e: ToGameEvent): void {
    for (const h of [...toGame]) h(e)
  }

  function flush(): void {
    if (!ready || toGame.size === 0) return
    const pending = queue
    queue = []
    for (const e of pending) dispatch(e)
  }

  return {
    send(e) {
      if (ready && toGame.size > 0) dispatch(e)
      else queue.push(e)
    },
    on(handler) {
      fromGame.add(handler)
      return () => {
        fromGame.delete(handler)
      }
    },
    onToGame(handler) {
      toGame.add(handler)
      flush()
      return () => {
        toGame.delete(handler)
      }
    },
    emit(e) {
      if (e.type === 'ready') {
        ready = true
        flush()
      }
      for (const h of [...fromGame]) h(e)
    },
    markReady() {
      ready = true
      flush()
    },
    destroy() {
      fromGame.clear()
      toGame.clear()
      queue = []
      ready = false
    },
  }
}
