import { describe, expect, it } from 'vitest'
import type { AnswerResult, Room } from '@/types/api'
import { createGameBridge, type FromGameEvent, type ToGameEvent } from './events'

describe('createGameBridge', () => {
  it('queues events until ready, then flushes in order', () => {
    const bridge = createGameBridge()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    bridge.send({ type: 'reset' })
    bridge.send({ type: 'set-phase', phase: 'exploring' })
    expect(got).toEqual([])
    bridge.emit({ type: 'ready' })
    expect(got.map((e) => e.type)).toEqual(['reset', 'set-phase'])
    bridge.send({ type: 'gate-open', roomId: 'room-1' })
    expect(got).toHaveLength(3)
  })

  it('queues and delivers the new dungeon events in order', () => {
    const bridge = createGameBridge()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    bridge.send({ type: 'load-dungeon', rooms: [] })
    bridge.send({ type: 'set-muted', value: true })
    bridge.send({ type: 'gate-open', roomId: 'room-1' })
    bridge.send({ type: 'set-phase', phase: 'victory' })
    expect(got).toEqual([])
    bridge.emit({ type: 'ready' })
    expect(got).toEqual([
      { type: 'load-dungeon', rooms: [] },
      { type: 'set-muted', value: true },
      { type: 'gate-open', roomId: 'room-1' },
      { type: 'set-phase', phase: 'victory' },
    ])
  })

  it('queues set-view-inset until ready and delivers it', () => {
    const bridge = createGameBridge()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    bridge.send({ type: 'set-view-inset', bottomFraction: 0.3 })
    expect(got).toEqual([])
    bridge.emit({ type: 'ready' })
    expect(got).toEqual([{ type: 'set-view-inset', bottomFraction: 0.3 }])
  })

  it('keeps every pre-existing event shape compiling and delivered (backward compatibility)', () => {
    const rooms: Room[] = []
    const result: AnswerResult = {
      correct: true,
      damage_dealt: 20,
      monster_hp_remaining: 40,
      player_hp_remaining: 100,
      score_delta: 100,
      xp_delta: 10,
      streak: 1,
      source: { page: 1, chunk_id: 'c' },
      review_status: 'not_due',
    }
    // Exhaustive list of the Phase 0 ToGameEvent shapes; a removed or changed field fails typecheck.
    const toGame: ToGameEvent[] = [
      { type: 'load-dungeon', rooms },
      { type: 'set-phase', phase: 'exploring' },
      { type: 'apply-result', result },
      { type: 'gate-open', roomId: 'r' },
      { type: 'reset' },
      { type: 'set-reduced-motion', value: true },
      { type: 'set-muted', value: false },
      { type: 'set-view-inset', bottomFraction: 0 },
    ]
    const fromGame: FromGameEvent[] = [
      { type: 'ready' },
      { type: 'encounter-started', monsterId: 'm' },
      { type: 'result-animation-done' },
      { type: 'pause-requested' },
      { type: 'room-entered', roomId: 'r' },
      { type: 'gate-opened', roomId: 'r' },
    ]
    const bridge = createGameBridge()
    const gotTo: ToGameEvent[] = []
    const gotFrom: FromGameEvent[] = []
    bridge.onToGame((e) => gotTo.push(e))
    bridge.on((e) => gotFrom.push(e))
    for (const e of toGame) bridge.send(e)
    bridge.emit({ type: 'ready' })
    for (const e of fromGame.slice(1)) bridge.emit(e)
    expect(gotTo).toEqual(toGame)
    expect(gotFrom).toEqual(fromGame)
  })

  it('delivers the additive set-viewport event after ready', () => {
    const bridge = createGameBridge()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    bridge.emit({ type: 'ready' })
    bridge.send({ type: 'set-viewport', width: 1366, height: 768 })
    expect(got).toEqual([{ type: 'set-viewport', width: 1366, height: 768 }])
  })

  it('delivers the additive encounter-open and encounter-close events in order', () => {
    const bridge = createGameBridge()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    bridge.send({ type: 'encounter-open', monsterId: 'm', side: 'left' })
    bridge.send({ type: 'encounter-close' })
    bridge.emit({ type: 'ready' })
    expect(got).toEqual([
      { type: 'encounter-open', monsterId: 'm', side: 'left' },
      { type: 'encounter-close' },
    ])
  })

  it('delivers the additive boss-phase-changed event to React', () => {
    const bridge = createGameBridge()
    const got: FromGameEvent[] = []
    bridge.on((e) => got.push(e))
    bridge.emit({ type: 'boss-phase-changed', phase: 'enraged' })
    bridge.emit({ type: 'boss-phase-changed', phase: 'defeated' })
    expect(got).toEqual([
      { type: 'boss-phase-changed', phase: 'enraged' },
      { type: 'boss-phase-changed', phase: 'defeated' },
    ])
  })

  it('delivers the additive revenant events in both directions', () => {
    const bridge = createGameBridge()
    const to: ToGameEvent[] = []
    const from: FromGameEvent[] = []
    bridge.onToGame((e) => to.push(e))
    bridge.on((e) => from.push(e))
    bridge.send({ type: 'spawn-revenants', roomId: 'room-1', revenants: [{ id: 'rev-q1', questionId: 'q1' }] })
    bridge.emit({ type: 'ready' })
    bridge.emit({ type: 'revenant-engaged', revenantId: 'rev-q1' })
    bridge.emit({ type: 'revenant-rested', revenantId: 'rev-q1' })
    expect(to).toEqual([{ type: 'spawn-revenants', roomId: 'room-1', revenants: [{ id: 'rev-q1', questionId: 'q1' }] }])
    expect(from.slice(1)).toEqual([
      { type: 'revenant-engaged', revenantId: 'rev-q1' },
      { type: 'revenant-rested', revenantId: 'rev-q1' },
    ])
  })

  it('delivers the additive game-feel events in both directions', () => {
    const bridge = createGameBridge()
    const to: ToGameEvent[] = []
    const from: FromGameEvent[] = []
    bridge.onToGame((e) => to.push(e))
    bridge.on((e) => from.push(e))
    bridge.send({ type: 'set-combo', tier: 3 })
    bridge.send({ type: 'play-boss-death', roomId: 'room-4' })
    bridge.send({ type: 'loot-burst' })
    bridge.send({ type: 'loot-burst', x: 10, y: 20 })
    bridge.emit({ type: 'ready' })
    bridge.emit({ type: 'boss-death-done', roomId: 'room-4' })
    expect(to).toEqual([
      { type: 'set-combo', tier: 3 },
      { type: 'play-boss-death', roomId: 'room-4' },
      { type: 'loot-burst' },
      { type: 'loot-burst', x: 10, y: 20 },
    ])
    expect(from.slice(1)).toEqual([{ type: 'boss-death-done', roomId: 'room-4' }])
  })

  it('delivers the additive touch events in both directions, in order', () => {
    const bridge = createGameBridge()
    const to: ToGameEvent[] = []
    const from: FromGameEvent[] = []
    bridge.onToGame((e) => to.push(e))
    bridge.on((e) => from.push(e))
    bridge.send({ type: 'set-touch-mode', value: true })
    bridge.send({ type: 'set-move-input', x: 0.5, y: -1 })
    bridge.send({ type: 'engage-request' })
    bridge.send({ type: 'set-move-input', x: 0, y: 0 })
    bridge.emit({ type: 'ready' })
    bridge.emit({ type: 'engage-available', kind: 'monster', name: 'Paper Wraith' })
    bridge.emit({ type: 'engage-available', kind: 'revenant' })
    bridge.emit({ type: 'engage-available', kind: null })
    expect(to).toEqual([
      { type: 'set-touch-mode', value: true },
      { type: 'set-move-input', x: 0.5, y: -1 },
      { type: 'engage-request' },
      { type: 'set-move-input', x: 0, y: 0 },
    ])
    expect(from.slice(1)).toEqual([
      { type: 'engage-available', kind: 'monster', name: 'Paper Wraith' },
      { type: 'engage-available', kind: 'revenant' },
      { type: 'engage-available', kind: null },
    ])
  })

  it('delivers room-entered and gate-opened to React', () => {
    const bridge = createGameBridge()
    const got: FromGameEvent[] = []
    bridge.on((e) => got.push(e))
    bridge.emit({ type: 'room-entered', roomId: 'room-2' })
    bridge.emit({ type: 'gate-opened', roomId: 'room-1' })
    expect(got).toEqual([
      { type: 'room-entered', roomId: 'room-2' },
      { type: 'gate-opened', roomId: 'room-1' },
    ])
  })

  it('flushes when a handler registers after markReady', () => {
    const bridge = createGameBridge()
    bridge.send({ type: 'reset' })
    bridge.markReady()
    const got: ToGameEvent[] = []
    bridge.onToGame((e) => got.push(e))
    expect(got).toHaveLength(1)
  })

  it('unsubscribes handlers and destroy clears state', () => {
    const bridge = createGameBridge()
    const got: FromGameEvent[] = []
    const off = bridge.on((e) => got.push(e))
    bridge.emit({ type: 'pause-requested' })
    off()
    bridge.emit({ type: 'pause-requested' })
    expect(got).toHaveLength(1)

    const toGot: ToGameEvent[] = []
    bridge.send({ type: 'reset' })
    bridge.destroy()
    bridge.onToGame((e) => toGot.push(e))
    bridge.markReady()
    expect(toGot).toEqual([])
  })
})
