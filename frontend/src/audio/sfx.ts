/**
 * Synthesized sound effects (Web Audio). No audio files.
 * Must not import @/api, @/demo, @/state, Phaser or React so src/game can use it.
 */

export type Cue =
  | 'footstep'
  | 'growl'
  | 'attack'
  | 'hit'
  | 'correct'
  | 'wrong'
  | 'gate'
  | 'victory'
  | 'defeat'
  | 'miss'
  | 'boss'

export const CUES: readonly Cue[] = [
  'miss',
  'boss',
  'footstep',
  'growl',
  'attack',
  'hit',
  'correct',
  'wrong',
  'gate',
  'victory',
  'defeat',
]

/** Quiet by default; the master gain never exceeds this. */
export const MASTER_GAIN = 0.25

/** Minimum ms between two plays of the same cue. */
const MIN_GAP_MS: Record<Cue, number> = {
  footstep: 250,
  growl: 400,
  attack: 80,
  hit: 80,
  correct: 150,
  wrong: 150,
  gate: 400,
  victory: 800,
  defeat: 800,
  miss: 200,
  boss: 1500,
}

/** Narrow slice of the Web Audio API that the engine uses (lets tests inject a fake). */
export interface SfxParam {
  value: number
  setValueAtTime(v: number, t: number): unknown
  linearRampToValueAtTime(v: number, t: number): unknown
  exponentialRampToValueAtTime(v: number, t: number): unknown
}
export interface SfxNode {
  connect(dest: unknown): unknown
}
export interface SfxGain extends SfxNode {
  gain: SfxParam
}
export interface SfxOsc extends SfxNode {
  type: OscillatorType
  frequency: SfxParam
  start(t?: number): void
  stop(t?: number): void
}
export interface SfxBufferSource extends SfxNode {
  buffer: unknown
  start(t?: number): void
  stop(t?: number): void
}
export interface SfxFilter extends SfxNode {
  type: BiquadFilterType
  frequency: SfxParam
}
export interface SfxContext {
  readonly currentTime: number
  readonly sampleRate: number
  readonly destination: unknown
  state?: string
  resume?(): unknown
  createGain(): SfxGain
  createOscillator(): SfxOsc
  createBufferSource(): SfxBufferSource
  createBiquadFilter(): SfxFilter
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array }
}

export type ContextFactory = () => SfxContext

const defaultFactory: ContextFactory = () => {
  const w = globalThis as unknown as { AudioContext?: new () => SfxContext; webkitAudioContext?: new () => SfxContext }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio not supported')
  return new Ctor()
}

export class SfxEngine {
  private ctx: SfxContext | null = null
  private master: SfxGain | null = null
  private noise: unknown = null
  private muted = false
  private readonly last = new Map<Cue, number>()

  constructor(
    private readonly factory: ContextFactory = defaultFactory,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** Creates the audio context on the first call (call from a user gesture). Never throws. */
  unlock(): void {
    if (this.ctx) {
      try {
        if (this.ctx.state === 'suspended') void this.ctx.resume?.()
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
      if (ctx.state === 'suspended') void ctx.resume?.()
    } catch {
      this.ctx = null
      this.master = null
    }
  }

  get unlocked(): boolean {
    return this.ctx !== null
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

  /** Returns true if a sound was scheduled. Never throws. */
  play(cue: Cue): boolean {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.muted) return false
    const now = this.clock()
    const prev = this.last.get(cue)
    if (prev !== undefined && now - prev < MIN_GAP_MS[cue]) return false
    try {
      this.schedule(ctx, master, cue)
    } catch {
      return false
    }
    this.last.set(cue, now)
    return true
  }

  // ----- synthesis helpers -----

  private tone(
    ctx: SfxContext,
    out: SfxNode,
    type: OscillatorType,
    f0: number,
    f1: number,
    t0: number,
    dur: number,
    peak: number,
  ): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t0)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.01, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noiseBurst(ctx: SfxContext, out: SfxNode, t0: number, dur: number, peak: number, cutoff: number): void {
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 0.5)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      let seed = 12345
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        data[i] = (seed / 0xffffffff) * 2 - 1
      }
      this.noise = buf
    }
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, t0)
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(out)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  private schedule(ctx: SfxContext, out: SfxNode, cue: Cue): void {
    const t = ctx.currentTime
    switch (cue) {
      case 'footstep':
        this.noiseBurst(ctx, out, t, 0.07, 0.25, 500)
        break
      case 'growl':
        this.tone(ctx, out, 'sawtooth', 90, 55, t, 0.5, 0.35)
        this.tone(ctx, out, 'square', 45, 40, t, 0.5, 0.2)
        break
      case 'attack':
        this.tone(ctx, out, 'triangle', 520, 1200, t, 0.18, 0.3)
        break
      case 'hit':
        this.noiseBurst(ctx, out, t, 0.12, 0.5, 1800)
        this.tone(ctx, out, 'square', 180, 70, t, 0.12, 0.3)
        break
      case 'correct':
        this.tone(ctx, out, 'sine', 660, 660, t, 0.12, 0.3)
        this.tone(ctx, out, 'sine', 990, 990, t + 0.09, 0.2, 0.3)
        break
      case 'wrong':
        this.tone(ctx, out, 'sawtooth', 220, 150, t, 0.25, 0.25)
        break
      case 'gate':
        this.noiseBurst(ctx, out, t, 0.6, 0.35, 700)
        this.tone(ctx, out, 'sawtooth', 70, 50, t, 0.6, 0.2)
        break
      case 'victory':
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone(ctx, out, 'triangle', f, f, t + i * 0.12, 0.3, 0.3))
        break
      case 'defeat':
        ;[330, 262, 196, 147].forEach((f, i) => this.tone(ctx, out, 'sawtooth', f, f * 0.97, t + i * 0.18, 0.35, 0.22))
        break
      case 'miss':
        // Soft whoosh: a short filtered breath, no pitched tone.
        this.noiseBurst(ctx, out, t, 0.18, 0.2, 900)
        break
      case 'boss':
        // Low two-note swell, quiet and brief.
        this.tone(ctx, out, 'sawtooth', 65, 62, t, 0.9, 0.25)
        this.tone(ctx, out, 'triangle', 98, 92, t + 0.15, 0.8, 0.18)
        break
    }
  }
}

/** Shared engine used by the app. */
export const sfx = new SfxEngine()
