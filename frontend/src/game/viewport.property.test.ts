import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  hudMode,
  hudRects,
  hudSafeBand,
  layoutClass,
  overlayRect,
  rectsIntersect,
  zoomForViewport,
} from './viewport'

const widthArb = fc.integer({ min: 320, max: 3840 })
const heightArb = fc.integer({ min: 480, max: 2160 })

describe('viewport helpers', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 1: Viewport zoom is bounded and on the grid
  // **Validates: Requirements 2.5, 2.6**
  it('Property 1: zoom is bounded, on the quarter grid and deterministic', () => {
    fc.assert(
      fc.property(widthArb, heightArb, (w, h) => {
        const z = zoomForViewport(w, h)
        expect(z).toBeGreaterThanOrEqual(0.75)
        expect(z).toBeLessThanOrEqual(3)
        expect(z * 4).toBe(Math.round(z * 4))
        expect(zoomForViewport(w, h)).toBe(z)
      }),
      { numRuns: 200 },
    )
  })

  // Feature: frontend-07-premium-ux-leaderboard, Property 2: HUD mode and safe band
  // **Validates: Requirements 3.2, 3.3**
  it('Property 2: compact below 640 and HUD bands never meet the safe band', () => {
    fc.assert(
      fc.property(widthArb, heightArb, (w, h) => {
        expect(hudMode(w)).toBe(w < 640 ? 'compact' : 'full')
        const band = hudSafeBand(w, h)
        expect(band.w).toBeGreaterThan(0)
        expect(band.h).toBeGreaterThan(0)
        for (const r of hudRects(w, h)) expect(rectsIntersect(r, band)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('overlayRect covers the viewport once zoomed about its centre', () => {
    fc.assert(
      fc.property(widthArb, heightArb, (w, h) => {
        const z = zoomForViewport(w, h)
        const r = overlayRect(w, h, z)
        // Screen corner (0,0) and (w,h) map to the overlay rect corners.
        expect((0 - w / 2) / z + w / 2).toBeCloseTo(r.x, 6)
        expect((w - w / 2) / z + w / 2).toBeCloseTo(r.x + r.w, 6)
        expect((h - h / 2) / z + h / 2).toBeCloseTo(r.y + r.h, 6)
      }),
      { numRuns: 100 },
    )
  })
})

describe('viewport examples', () => {
  it.each([
    [1366, 768, 1.5],
    [1536, 864, 1.5],
    [1920, 1080, 2],
    [2560, 1440, 2.75],
    [390, 844, 0.75],
  ])('zoom for %ix%i is %f', (w, h, z) => {
    expect(zoomForViewport(w, h)).toBe(z)
  })

  it('classifies layouts', () => {
    expect(layoutClass(390, 844)).toBe('phone')
    expect(layoutClass(800, 600)).toBe('tablet')
    expect(layoutClass(1366, 768)).toBe('desktop')
    expect(layoutClass(2560, 1440)).toBe('wide')
  })

  it('falls back to the minimum zoom for non-finite input', () => {
    expect(zoomForViewport(Number.NaN, 500)).toBe(0.75)
    expect(zoomForViewport(0, 0)).toBe(0.75)
  })
})
