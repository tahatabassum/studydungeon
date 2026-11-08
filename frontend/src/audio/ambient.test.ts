import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientEngine,
  BED_GAIN,
  FIRST_MAX_MS,
  FIRST_MIN_MS,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  ONESHOT_GAIN,
} from './ambient'
import { MASTER_GAIN, type SfxContext } from './sfx'

function param(peaks?: number[]) {
  return {
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: (v: number) => void peaks?.push(v),
    exponentialRampToValueAtTime: () => undefined,
  }
}

function fakeContext(initialState = 'running') {
  const gains: { gain: ReturnType<typeof param> }[] = []
  const peaks: number[] = []
  const stats = {
    oneShots: 0,
    bedStarted: 0,
    bedStopped: 0,
    closed: 0,
    resumed: 0,
    /** Oscillator types in start order (sine = owl hoot or vibrato, sawtooth = creak). */
    types: [] as string[],
  }
  const ctx = {
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    state: initialState,
    resume: () => void stats.resumed++,
    close: () => void stats.closed++,
    createGain() {
      const node = { gain: param(peaks), connect: () => undefined }
      gains.push(node)
      return node
    },
    createOscillator() {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: param(),
        connect: () => undefined,
        start: () => {
          stats.oneShots++
          stats.types.push(osc.type)
        },
        stop: () => undefined,
      }
      return osc
    },
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
  return { ctx: ctx as unknown as SfxContext & { state: string }, gains, stats, peaks }
}

describe('AmbientEngine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the bed at or below 5 percent of master and one-shots at the new ceiling', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0.9)
    engine.start()
    expect(BED_GAIN).toBeLessThanOrEqual(0.05)
    expect(ONESHOT_GAIN).toBeLessThanOrEqual(0.35)
    expect(ONESHOT_GAIN).toBeGreaterThan(0.1)
    expect(f.gains[0].gain.value).toBe(MASTER_GAIN)
    expect(f.gains[1].gain.value).toBeLessThanOrEqual(0.05)
    expect(f.stats.bedStarted).toBe(1)
  })

  it('never ramps a one-shot above the gain ceiling', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    vi.advanceTimersByTime(FIRST_MAX_MS)
    vi.advanceTimersByTime(MAX_INTERVAL_MS)
    expect(f.peaks.length).toBeGreaterThan(0)
    expect(Math.max(...f.peaks)).toBeLessThanOrEqual(ONESHOT_GAIN)
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

  it('plays the first one-shot within 8 to 15 seconds', () => {
    const lo = fakeContext()
    const a = new AmbientEngine(() => lo.ctx, () => 0)
    a.start()
    vi.advanceTimersByTime(FIRST_MIN_MS - 1)
    expect(lo.stats.oneShots).toBe(0)
    vi.advanceTimersByTime(1)
    expect(lo.stats.oneShots).toBeGreaterThan(0)
    a.stop()

    const hi = fakeContext()
    const b = new AmbientEngine(() => hi.ctx, () => 0.999999)
    b.start()
    vi.advanceTimersByTime(FIRST_MAX_MS)
    expect(hi.stats.oneShots).toBeGreaterThan(0)
    b.stop()
  })

  it('uses 20 to 60 seconds for later one-shots', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    vi.advanceTimersByTime(FIRST_MIN_MS)
    const afterFirst = f.stats.oneShots
    vi.advanceTimersByTime(MIN_INTERVAL_MS - 1)
    expect(f.stats.oneShots).toBe(afterFirst)
    vi.advanceTimersByTime(1)
    expect(f.stats.oneShots).toBeGreaterThan(afterFirst)
  })

  it('alternates owl and creak, owl first', () => {
    const f = fakeContext()
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    vi.advanceTimersByTime(FIRST_MIN_MS)
    // Owl: only sine and triangle oscillators, no sawtooth.
    expect(f.stats.types).not.toContain('sawtooth')
    expect(f.stats.types).toContain('triangle')
    f.stats.types.length = 0
    vi.advanceTimersByTime(MIN_INTERVAL_MS)
    expect(f.stats.types).toEqual(['sawtooth'])
    f.stats.types.length = 0
    vi.advanceTimersByTime(MIN_INTERVAL_MS)
    expect(f.stats.types).toContain('triangle')
    expect(f.stats.types).not.toContain('sawtooth')
  })

  it('resumes a suspended context and retries on the next gesture', () => {
    const f = fakeContext('suspended')
    const engine = new AmbientEngine(() => f.ctx, () => 0)
    engine.start()
    expect(f.stats.resumed).toBe(1)
    window.dispatchEvent(new Event('pointerdown'))
    expect(f.stats.resumed).toBe(2)
    f.ctx.state = 'running'
    window.dispatchEvent(new Event('keydown'))
    window.dispatchEvent(new Event('keydown'))
    expect(f.stats.resumed).toBe(2)
    engine.stop()
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
