import { describe, expect, it } from 'vitest'
import { clampViewInset } from './viewInset'

describe('clampViewInset', () => {
  it('clamps to [0, 0.45] and maps NaN to 0', () => {
    expect(clampViewInset(NaN)).toBe(0)
    expect(clampViewInset(-1)).toBe(0)
    expect(clampViewInset(0.3)).toBe(0.3)
    expect(clampViewInset(0.9)).toBe(0.45)
    expect(clampViewInset(Infinity)).toBe(0.45)
    expect(clampViewInset(-Infinity)).toBe(0)
  })
})
