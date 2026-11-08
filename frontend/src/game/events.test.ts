import { describe, expect, it } from 'vitest'
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
