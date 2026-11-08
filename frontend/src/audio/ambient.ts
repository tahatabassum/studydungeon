/**
 * Ambient sound bed (Web Audio, no audio files): a low wind drone plus occasional
 * creaks and a distant owl at random 20 to 60 s intervals.
 * Must not import @/api, @/demo, @/state, Phaser or React.
 */
import { MASTER_GAIN, type ContextFactory, type SfxBufferSource, type SfxContext, type SfxGain, type SfxNode } from './sfx'

/** Wind drone gain relative to master (requirement: at most 5 percent). */
export const BED_GAIN = 0.05
/** Creak and owl peak gain relative to master (design D8: at most 10 percent). */
export const ONESHOT_GAIN = 0.1
export const MIN_INTERVAL_MS = 20_000
export const MAX_INTERVAL_MS = 60_000

const defaultFactory: ContextFactory = () => {
  const w = globalThis as unknown as { AudioContext?: new () => SfxContext; webkitAudioContext?: new () => SfxContext }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio not supported')
  return new Ctor()
}

type LoopSource = SfxBufferSource & { loop: boolean }

export class AmbientEngine {
  private ctx: SfxContext | null = null
  private master: SfxGain | null = null
  private bedSource: LoopSource | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private muted = false

  constructor(
    private readonly factory: ContextFactory = defaultFactory,
    private readonly random: () => number = Math.random,
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  /** Starts the bed and the creak timer. Call from a user gesture. Never throws. */
  start(): void {
    if (this.running) {
      try {
        if (this.ctx?.state === 'suspended') void this.ctx.resume?.()
      } catch {
        /* ignore */
      }
      return
    }
    try {
      const ctx = this.factory()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : MASTER_GAIN
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
      this.startBed(ctx, master)
      this.running = true
      if (ctx.state === 'suspended') void ctx.resume?.()
      this.scheduleNext()
    } catch {
      this.teardown()
    }
  }

  /** Stops all sound and clears the timer and nodes. Safe to call repeatedly. */
  stop(): void {
    this.teardown()
  }

  setMuted(value: boolean): void {
    this.muted = value
    try {
      if (this.master) this.master.gain.value = value ? 0 : MASTER_GAIN
    } catch {
      /* ignore */
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  // ----- internals -----

  private teardown(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      this.bedSource?.stop()
    } catch {
      /* ignore */
    }
    try {
      const closable = this.ctx as (SfxContext & { close?: () => unknown }) | null
      void closable?.close?.()
    } catch {
      /* ignore */
    }
    this.bedSource = null
    this.master = null
    this.ctx = null
    this.running = false
  }

  private noiseBuffer(ctx: SfxContext, seconds: number): unknown {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let seed = 9876
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      data[i] = (seed / 0xffffffff) * 2 - 1
    }
    return buf
  }

  private startBed(ctx: SfxContext, out: SfxNode): void {
    const src = ctx.createBufferSource() as LoopSource
    src.buffer = this.noiseBuffer(ctx, 2)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(260, ctx.currentTime)
    const g = ctx.createGain()
    g.gain.value = BED_GAIN
    src.connect(filter)
    filter.connect(g)
    g.connect(out)
    src.start()
    this.bedSource = src
  }

  private scheduleNext(): void {
    const span = MAX_INTERVAL_MS - MIN_INTERVAL_MS
    const delay = MIN_INTERVAL_MS + Math.floor(this.random() * span)
    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.running) return
      this.playOneShot()
      this.scheduleNext()
    }, delay)
  }

  private playOneShot(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.muted) return
    try {
      if (this.random() < 0.5) this.creak(ctx, master)
      else this.owl(ctx, master)
    } catch {
      /* ignore */
    }
  }

  private voice(ctx: SfxContext, out: SfxNode, type: OscillatorType, f0: number, f1: number, t0: number, dur: number): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t0)
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(ONESHOT_GAIN, t0 + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private creak(ctx: SfxContext, out: SfxNode): void {
    const t = ctx.currentTime
    this.voice(ctx, out, 'sawtooth', 140, 90, t, 0.9)
  }

  private owl(ctx: SfxContext, out: SfxNode): void {
    const t = ctx.currentTime
    this.voice(ctx, out, 'sine', 420, 360, t, 0.45)
    this.voice(ctx, out, 'sine', 400, 330, t + 0.6, 0.6)
  }
}

/** Shared engine used by the app. */
export const ambient = new AmbientEngine()
