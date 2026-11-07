import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CUES, MASTER_GAIN, SfxEngine, type Cue, type SfxContext } from './sfx'

function fakeParam() {
  return {
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  }
}

function fakeContext(): SfxContext & { started: number; masterGain: { value: number } | null } {
  let started = 0
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    state: 'running',
    masterGain: null as { value: number } | null,
    get started() {
      return started
    },
    createGain() {
      const node = { gain: fakeParam(), connect: () => undefined }
      if (!ctx.masterGain) ctx.masterGain = node.gain
      return node
    },
    createOscillator: () => ({
      type: 'sine' as OscillatorType,
      frequency: fakeParam(),
      connect: () => undefined,
      start: () => void started++,
      stop: () => undefined,
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: () => undefined,
      start: () => void started++,
      stop: () => undefined,
    }),
    createBiquadFilter: () => ({
      type: 'lowpass' as BiquadFilterType,
      frequency: fakeParam(),
      connect: () => undefined,
    }),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  }
  return ctx
}

type Op = { op: 'unlock' } | { op: 'mute' } | { op: 'unmute' } | { op: 'play'; cue: Cue }

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ op: 'unlock' }),
  fc.constant<Op>({ op: 'mute' }),
  fc.constant<Op>({ op: 'unmute' }),
  fc.constantFrom(...CUES).map<Op>((cue) => ({ op: 'play', cue })),
)

describe('sfx', () => {
  // Feature: frontend-04-rpg-ui-combat-flow, Property 16: Sound mute gating
  // **Validates: Requirements 19.2, 19.4, 19.7**
  it('Property 16: Sound mute gating', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 60 }), fc.boolean(), (ops, factoryThrows) => {
        let created = 0
        let clock = 0
        const engine = new SfxEngine(() => {
          created++
          if (factoryThrows) throw new Error('no audio')
          return fakeContext()
        }, () => (clock += 1000)) // always past every rate limit
        let unlocked = false
        let muted = false
        let unlockCalled = false
        for (const o of ops) {
          if (o.op === 'unlock') {
            unlockCalled = true
            engine.unlock()
            if (!factoryThrows) unlocked = true
          } else if (o.op === 'mute') {
            engine.setMuted(true)
            muted = true
          } else if (o.op === 'unmute') {
            engine.setMuted(false)
            muted = false
          } else {
            const scheduled = engine.play(o.cue)
            expect(scheduled).toBe(unlocked && !muted)
          }
          if (!unlockCalled) expect(created).toBe(0)
          expect(engine.isMuted()).toBe(muted)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('has all cues, schedules each when unlocked, and keeps master gain quiet', () => {
    const ctx = fakeContext()
    let t = 0
    const engine = new SfxEngine(() => ctx, () => (t += 1000))
    expect(MASTER_GAIN).toBeLessThanOrEqual(0.3)
    engine.unlock()
    expect(ctx.masterGain?.value).toBeLessThanOrEqual(0.3)
    for (const cue of CUES) expect(engine.play(cue)).toBe(true)
    expect(ctx.started).toBeGreaterThan(0)
    engine.setMuted(true)
    expect(ctx.masterGain?.value).toBe(0)
  })

  it('rate limits repeated footsteps', () => {
    let t = 0
    const engine = new SfxEngine(() => fakeContext(), () => t)
    engine.unlock()
    expect(engine.play('footstep')).toBe(true)
    t = 100
    expect(engine.play('footstep')).toBe(false)
    t = 300
    expect(engine.play('footstep')).toBe(true)
  })

  it('does not throw when the factory throws', () => {
    const engine = new SfxEngine(() => {
      throw new Error('boom')
    })
    expect(() => engine.unlock()).not.toThrow()
    expect(engine.play('hit')).toBe(false)
  })
})
