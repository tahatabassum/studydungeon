import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AmbientEngine, BED_GAIN, MAX_INTERVAL_MS, MIN_INTERVAL_MS, ONESHOT_GAIN } from './ambient'
import { MASTER_GAIN, type SfxContext } from './sfx'

function param() {
  return {
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  }
}

function fakeContext() {
  const gains: { gain: ReturnType<typeof param> }[] = []
  const stats = { oneShots: 0, bedStarted: 0, bedStopped: 0, closed: 0 }
  const ctx = {
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    state: 'running',
    close: () => void stats.closed++,
    createGain() {
      const node = { gain: param(), connect: () => undefined }
      gains.push(node)
      return node
    },
    createOscillator: () => ({
      type: 'sine' as OscillatorType,
      frequency: param(),
      connect: () => undefined,
      start: () => void stats.oneShots++,
      stop: () => undefined,
    }),
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      connect: () => undefined,
      start: () => void stats.bedStarted++,
      stop: () => void stats.bedStopped++,
    }),
    createBiquadFilter: () => ({ type: 'lowpass' as BiquadFilterType, frequency: param(), connect: () => undefined }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  }
  return { ctx: ctx as unknown as SfxContext, gains, stats }
}

describe('AmbientEngine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the bed at or below 5 percent of master and master quiet', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0.9)
    engine.start()
    expect(BED_GAIN).toBeLessThanOrEqual(0.05)
    expect(ONESHOT_GAIN).toBeLessThanOrEqual(0.1)
    expect(f.gains[0].gain.value).toBe(MASTER_GAIN)
    expect(f.gains[1].gain.value).toBeLessThanOrEqual(0.05)
    expect(f.stats.bedStarted).toBe(1)
  })

  it('produces no output when muted', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.setMuted(true)
    engine.start()
    expect(f.gains[0].gain.value).toBe(0)
    vi.advanceTimersByTime(MAX_INTERVAL_MS * 3)
    expect(f.stats.oneShots).toBe(0)
    engine.setMuted(false)
    expect(f.gains[0].gain.value).toBe(MASTER_GAIN)
    vi.advanceTimersByTime(MAX_INTERVAL_MS)
    expect(f.stats.oneShots).toBeGreaterThan(0)
  })

  it('schedules one-shots within 20 to 60 seconds', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    vi.advanceTimersByTime(MIN_INTERVAL_MS - 1)
    expect(f.stats.oneShots).toBe(0)
    vi.advanceTimersByTime(1)
    expect(f.stats.oneShots).toBeGreaterThan(0)
  })

  it('does not throw when the context is unavailable', () => {
    const engine = new AmbientEngine(() => {
      throw new Error('no audio')
    })
    expect(() => engine.start()).not.toThrow()
    expect(engine.isRunning).toBe(false)
    expect(() => engine.setMuted(true)).not.toThrow()
    expect(() => engine.stop()).not.toThrow()
  })

  it('stop clears timers and nodes', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    engine.stop()
    expect(engine.isRunning).toBe(false)
    expect(f.stats.bedStopped).toBe(1)
    expect(f.stats.closed).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(MAX_INTERVAL_MS * 2)
    expect(f.stats.oneShots).toBe(0)
  })
})
