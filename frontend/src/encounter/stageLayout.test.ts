import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { intersects, overlapDepth, stageLayout } from './stageLayout'

describe('stageLayout', () => {
  /** **Validates: Requirements 5.9** */
  it('keeps the portrait off the panel content and within 32px of overlap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 3000 }),
        fc.integer({ min: 480, max: 2000 }),
        fc.constantFrom('left', 'right'),
        fc.integer({ min: 120, max: 480 }),
        (vw, vh, side, panelH) => {
          const l = stageLayout(vw, vh, side, panelH)
          expect(intersects(l.portrait, l.content)).toBe(false)
          expect(overlapDepth(l)).toBeLessThanOrEqual(32)
          expect(l.portrait.x).toBeGreaterThanOrEqual(0)
          expect(l.portrait.x + l.portrait.w).toBeLessThanOrEqual(vw + 0.001)
        },
      ),
    )
  })

  it('puts the portrait beside the panel on desktop and above it on phones', () => {
    expect(stageLayout(1024, 635, 'right', 300).mode).toBe('row')
    expect(stageLayout(390, 844, 'left', 400).mode).toBe('column')
  })
})
