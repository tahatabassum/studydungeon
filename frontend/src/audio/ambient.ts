/**
 * Ambient sound bed (Web Audio, no audio files): a low wind drone plus occasional
 * creaks and a distant owl at random 20 to 60 s intervals.
 * Must not import @/api, @/demo, @/state, Phaser or React.
 */
import {
  MASTER_GAIN,
  type ContextFactory,
  type SfxBufferSource,
  type SfxContext,
  type SfxFilter,
  type SfxGain,
  type SfxNode,
  type SfxOsc,
} from './sfx'

/** Wind drone gain relative to master (requirement: at most 5 percent). */
export const BED_GAIN = 0.05
/**
 * Creak and owl peak gain relative to master. Raised from 0.1 to 0.35 (about 0.09 absolute
 * with the 0.25 master) so the owl is clearly audible but still soft.
 */
export const ONESHOT_GAIN = 0.35
/** Bed low-pass cutoff in Hz: normal, and the darker enraged variant. */
export const BED_CUTOFF_HZ = 260
export const ENRAGED_BED_CUTOFF_HZ = 170
/** Enraged sub-drone pitch (Hz) and gain relative to master. It stays below the 5 percent bed ceiling. */
export const ENRAGED_DRONE_HZ = 55
export const ENRAGED_DRONE_GAIN = 0.03
export const MIN_INTERVAL_MS = 20_000
export const MAX_INTERVAL_MS = 60_000
/** The first one-shot comes early so the player hears the owl soon after starting. */
export const FIRST_MIN_MS = 8_000
export const FIRST_MAX_MS = 15_000

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
  private oneShotCount = 0
  private gestureAttached = false
  private enraged = false
  private bedFilter: SfxFilter | null = null
  private droneOsc: SfxOsc | null = null

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
      this.tryResume()
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
      this.applyEnraged()
      this.tryResume()
      this.scheduleNext()
    } catch {
      this.teardown()
    }
  }

  /** Resumes a suspended context; if it is still suspended, retries on the next gesture. */
  private tryResume(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'suspended') return
    try {
      void ctx.resume?.()
    } catch {
      /* ignore */
    }
    if (this.gestureAttached || typeof window === 'undefined') return
    this.gestureAttached = true
    const retry = () => {
      if (this.ctx?.state === 'suspended') {
        try {
          void this.ctx.resume?.()
        } catch {
          /* ignore */
        }
      }
      if (this.ctx?.state !== 'suspended') this.detachGesture(retry)
    }
    this.retryHandler = retry
    window.addEventListener('keydown', retry)
    window.addEventListener('pointerdown', retry)
  }

  private retryHandler: (() => void) | null = null

  private detachGesture(handler: (() => void) | null = this.retryHandler): void {
    if (handler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('pointerdown', handler)
    }
    this.retryHandler = null
    this.gestureAttached = false
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

  isEnraged(): boolean {
    return this.enraged
  }

  /**
   * Boss enraged variant: a darker bed, a quiet low sub-drone and no owl (creaks only).
   * Remembered while stopped and applied on start; mute still silences everything via the master.
   */
  setEnraged(value: boolean): void {
    this.enraged = value
    this.applyEnraged()
  }

  private applyEnraged(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    try {
      this.bedFilter?.frequency.setValueAtTime(this.enraged ? ENRAGED_BED_CUTOFF_HZ : BED_CUTOFF_HZ, ctx.currentTime)
      if (this.enraged && !this.droneOsc) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(ENRAGED_DRONE_HZ, ctx.currentTime)
        g.gain.value = ENRAGED_DRONE_GAIN
        osc.connect(g)
        g.connect(master)
        osc.start()
        this.droneOsc = osc
      } else if (!this.enraged && this.droneOsc) {
        this.droneOsc.stop()
        this.droneOsc = null
      }
    } catch {
      /* ignore */
    }
  }

  // ----- internals -----

  private teardown(): void {
    this.detachGesture()
    this.oneShotCount = 0
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
    try {
      this.droneOsc?.stop()
    } catch {
      /* ignore */
    }
    this.droneOsc = null
    this.bedFilter = null
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
    filter.frequency.setValueAtTime(BED_CUTOFF_HZ, ctx.currentTime)
    this.bedFilter = filter
    const g = ctx.createGain()
    g.gain.value = BED_GAIN
    src.connect(filter)
    filter.connect(g)
    g.connect(out)
    src.start()
    this.bedSource = src
  }

  private scheduleNext(): void {
    const [lo, hi] = this.oneShotCount === 0 ? [FIRST_MIN_MS, FIRST_MAX_MS] : [MIN_INTERVAL_MS, MAX_INTERVAL_MS]
    const delay = lo + Math.floor(this.random() * (hi - lo))
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
    this.tryResume()
    try {
      // Alternate, owl first.
      const isOwl = !this.enraged && this.oneShotCount % 2 === 0
      this.oneShotCount++
      if (isOwl) this.owl(ctx, master)
      else this.creak(ctx, master)
    } catch {
      /* ignore */
    }
  }

  private voice(ctx: SfxContext, out: SfxNode, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, scale = 1): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t0)
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(ONESHOT_GAIN * scale, t0 + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private creak(ctx: SfxContext, out: SfxNode): void {
    const t = ctx.currentTime
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(700, t)
    lp.connect(out)
    // Sawtooth is harsh, so keep it a bit under the owl.
    this.voice(ctx, lp, 'sawtooth', 140, 90, t, 0.9, 0.6)
  }

  /** "hoo-hoo... hoooo": two or three soft hoots, slightly muffled for distance. */
  private owl(ctx: SfxContext, out: SfxNode): void {
    const t = ctx.currentTime
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1400, t)
    lp.connect(out)
    const hoots: Array<[number, number, number]> =
      this.random() < 0.5
        ? [
            [0, 0.3, 400],
            [0.5, 0.3, 390],
            [1.5, 0.9, 360],
          ]
        : [
            [0, 0.35, 410],
            [0.8, 0.95, 350],
          ]
    for (const [offset, dur, f] of hoots) this.hoot(ctx, lp, t + offset, dur, f)
  }

  private hoot(ctx: SfxContext, out: SfxNode, t0: number, dur: number, f: number): void {
    const attack = Math.min(0.08, dur * 0.3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(ONESHOT_GAIN, t0 + attack)
    g.gain.linearRampToValueAtTime(ONESHOT_GAIN * 0.8, t0 + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    g.connect(out)

    const body = ctx.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(f, t0)
    body.frequency.exponentialRampToValueAtTime(f * 0.88, t0 + dur)
    body.connect(g)

    // Quiet second harmonic for a rounder tone.
    const harm = ctx.createOscillator()
    const hg = ctx.createGain()
    harm.type = 'triangle'
    harm.frequency.setValueAtTime(f * 2, t0)
    harm.frequency.exponentialRampToValueAtTime(f * 2 * 0.88, t0 + dur)
    hg.gain.value = 0.2
    harm.connect(hg)
    hg.connect(g)

    // Light vibrato (5 Hz, about 4 Hz deep) on the body.
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(5, t0)
    depth.gain.value = 4
    lfo.connect(depth)
    depth.connect(body.frequency)

    for (const o of [body, harm, lfo]) {
      o.start(t0)
      o.stop(t0 + dur + 0.05)
    }
  }
}

/** Shared engine used by the app. */
export const ambient = new AmbientEngine()
