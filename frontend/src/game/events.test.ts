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
    bridge.send({ type: 'room-cleared' })
    expect(got).toHaveLength(3)
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
