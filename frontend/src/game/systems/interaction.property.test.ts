import { describe, it } from 'vitest'
import fc from 'fast-check'
import { shouldEngage } from './interaction'
import type { GamePhase } from '../events'

// Feature: frontend-04-rpg-ui-combat-flow, Property 1: Engage rule
// **Validates: Requirements 1.2, 1.3, 1.7**

const PHASES: GamePhase[] = ['exploring', 'encounter', 'resolving', 'cleared', 'defeated', 'paused', 'victory']
const phaseArb = fc.constantFrom(...PHASES)

interface Frame {
  phase: GamePhase
  inRange: boolean
  alive: boolean
  keyHeld: boolean
  justPressed: boolean
}

/**
 * Pure mirror of InteractionSystem.update arm/disarm logic:
 * re-arm when phase !== 'exploring' or no key held; disarm on engage.
 * A just-pressed frame always has the key held (Phaser JustDown implies isDown).
 */
function step(armed: boolean, f: Frame): { armed: boolean; engaged: boolean } {
  const held = f.keyHeld || f.justPressed
  let a = armed
  if (f.phase !== 'exploring' || !held) a = true
  if (f.phase !== 'exploring') return { armed: a, engaged: false }
  const engaged = shouldEngage({
    phase: f.phase,
    inRange: f.inRange,
    alive: f.alive,
    pressed: f.justPressed,
    armed: a,
  })
  return { armed: engaged ? false : a, engaged }
}

describe('Property 1: Engage rule', () => {
  it('shouldEngage is true iff exploring && inRange && alive && pressed && armed', () => {
    fc.assert(
      fc.property(phaseArb, fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (phase, inRange, alive, pressed, armed) => {
        return (
          shouldEngage({ phase, inRange, alive, pressed, armed }) ===
          (phase === 'exploring' && inRange && alive && pressed && armed)
        )
      }),
      { numRuns: 200 },
    )
  })

  it('engage count never exceeds distinct presses made while exploring in range', () => {
    const frameArb = fc.record({
      phase: phaseArb,
      inRange: fc.boolean(),
      alive: fc.boolean(),
      keyHeld: fc.boolean(),
      justPressed: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.array(frameArb, { maxLength: 100 }), fc.boolean(), (frames, startArmed) => {
        let armed = startArmed
        let engages = 0
        let presses = 0
        for (const f of frames) {
          if (f.justPressed && f.phase === 'exploring' && f.inRange && f.alive) presses++
          const r = step(armed, f)
          armed = r.armed
          if (r.engaged) engages++
        }
        return engages <= presses
      }),
      { numRuns: 200 },
    )
  })

  it('a held key never engages twice without a release or non-exploring frame between', () => {
    const frameArb = fc.record({
      phase: phaseArb,
      inRange: fc.boolean(),
      alive: fc.boolean(),
      keyHeld: fc.boolean(),
      justPressed: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.array(frameArb, { maxLength: 100 }), (frames) => {
        let armed = true
        let sinceReset = false // an engage happened and no re-arm event since
        for (const f of frames) {
          const held = f.keyHeld || f.justPressed
          if (f.phase !== 'exploring' || !held) sinceReset = false
          const r = step(armed, f)
          armed = r.armed
          if (r.engaged) {
            if (sinceReset) return false
            sinceReset = true
          }
        }
        return true
      }),
      { numRuns: 200 },
    )
  })
})
