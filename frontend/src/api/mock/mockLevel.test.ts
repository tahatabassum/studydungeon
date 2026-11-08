import { describe, expect, it } from 'vitest'
import { parseMockLevel } from './mockLevel'

describe('parseMockLevel (dev-only ?mockLevel=N)', () => {
  it('reads a whole level in dev', () => {
    expect(parseMockLevel('?mockLevel=8', true)).toBe(8)
    expect(parseMockLevel('?a=1&mockLevel=3', true)).toBe(3)
  })

  it('is ignored outside dev and for invalid values', () => {
    expect(parseMockLevel('?mockLevel=8', false)).toBeUndefined()
    for (const bad of ['', '?mockLevel=', '?mockLevel=0', '?mockLevel=-2', '?mockLevel=abc', '?mockLevel=1.5', '?mockLevel=100']) {
      expect(parseMockLevel(bad, true), bad).toBeUndefined()
    }
  })
})
