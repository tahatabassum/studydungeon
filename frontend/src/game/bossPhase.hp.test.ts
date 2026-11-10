import { describe, expect, it } from 'vitest'
import { bossPhase } from './bossPhase'

// The real bosses have 220 to 300 HP (C7): the enrage line is half of the HP the backend sent.
describe('bossPhase with the real boss HP', () => {
  it('220 HP: 110 is normal, 109 is enraged, 0 is defeated', () => {
    expect(bossPhase(220, 220)).toBe('normal')
    expect(bossPhase(110, 220)).toBe('normal')
    expect(bossPhase(109, 220)).toBe('enraged')
    expect(bossPhase(0, 220)).toBe('defeated')
  })

  it('240 and 300 HP follow the same half-way rule', () => {
    expect(bossPhase(120, 240)).toBe('normal')
    expect(bossPhase(119, 240)).toBe('enraged')
    expect(bossPhase(150, 300)).toBe('normal')
    expect(bossPhase(149, 300)).toBe('enraged')
  })
})
