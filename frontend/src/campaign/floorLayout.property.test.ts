import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { FinalBoss, Floor, FloorStatus } from '../types/api'
import {
  COL_PITCH,
  NAV_KEYS,
  PAD_X,
  RENDER_ALL_UP_TO,
  fitPitch,
  layoutFloors,
  nextFocus,
  nextPlayable,
  segmentPath,
  visibleRange,
} from './floorLayout'

const STATUSES: FloorStatus[] = ['locked', 'ready', 'generating', 'failed', 'cleared']

function floorOf(i: number, status: FloorStatus): Floor {
  return {
    id: `floor-${i + 1}`,
    index: i + 1,
    title: `Floor ${i + 1}`,
    status,
    topics: [],
    boss: { id: `m${i}`, name: `Boss ${i}`, hp: 80 },
    rank: null,
    room_ids: [],
  }
}

describe('floor map logic', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 11: Virtualization covers the viewport and the focused node
  // **Validates: Requirements 5.8**
  it('Property 11: visibleRange covers every intersecting column and the focused column, within the count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 16000 }),
        fc.integer({ min: 1, max: 2800 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: -1, max: 70 }),
        (count, scrollLeft, viewportW, overscan, focused) => {
          const { start, end } = visibleRange(scrollLeft, viewportW, count, COL_PITCH, overscan, focused)
          expect(start).toBeGreaterThanOrEqual(0)
          expect(end).toBeLessThanOrEqual(count)
          expect(start).toBeLessThanOrEqual(end)
          if (count <= RENDER_ALL_UP_TO) {
            expect(start).toBe(0)
            expect(end).toBe(count)
            return
          }
          for (let i = 0; i < count; i += 1) {
            const left = i * COL_PITCH
            const intersects = left < scrollLeft + viewportW && left + COL_PITCH > scrollLeft
            if (intersects) {
              expect(i, `column ${i}`).toBeGreaterThanOrEqual(start)
              expect(i, `column ${i}`).toBeLessThan(end)
            }
          }
          if (focused >= 0 && focused < count) {
            expect(focused).toBeGreaterThanOrEqual(start)
            expect(focused).toBeLessThan(end)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('renders a small window for 25 floors at the top of the map', () => {
    const { start, end } = visibleRange(0, 768, 25)
    expect(start).toBe(0)
    expect(end - start).toBeLessThan(12)
  })

  // Feature: frontend-08-campaign-learning-loop, Property 12: Keyboard navigation reaches every node
  // **Validates: Requirements 5.9**
  it('Property 12: ArrowDown visits every node once, Home and End jump, the index stays in range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), fc.array(fc.constantFrom(...NAV_KEYS), { maxLength: 40 }), (count, keys) => {
        const seen: number[] = [0]
        let i = 0
        for (let step = 0; step < count + 3; step += 1) {
          const next = nextFocus(i, 'ArrowDown', count)
          if (next === i) break
          i = next
          seen.push(i)
        }
        expect(seen).toEqual(Array.from({ length: count }, (_, k) => k))
        expect(nextFocus(i, 'ArrowDown', count)).toBe(count - 1)
        expect(nextFocus(count - 1, 'Home', count)).toBe(0)
        expect(nextFocus(0, 'End', count)).toBe(count - 1)
        let j = Math.floor(count / 2)
        for (const key of keys) {
          j = nextFocus(j, key, count)
          expect(j).toBeGreaterThanOrEqual(0)
          expect(j).toBeLessThan(count)
        }
      }),
      { numRuns: 100 },
    )
  })

  // Feature: frontend-08-campaign-learning-loop, Property 13: Continue picks the first playable floor
  // **Validates: Requirements 5.10, 5.6**
  it('Property 13: the first ready floor, else the unlocked Final_Boss, else null', () => {
    const final = (unlocked: boolean): FinalBoss => ({ id: 'final', name: 'The Exam Warden', hp: 220, unlocked })
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...STATUSES), { maxLength: 30 }),
        fc.boolean(),
        fc.boolean(),
        (statuses, unlocked, hasFinal) => {
          const floors = statuses.map((s, i) => floorOf(i, s))
          const boss = hasFinal ? final(unlocked) : undefined
          const target = nextPlayable(floors, boss)
          const firstReady = statuses.indexOf('ready')
          if (firstReady >= 0) {
            expect(target).toEqual({ type: 'floor', floor: floors[firstReady], index: firstReady })
          } else if (hasFinal && unlocked) {
            expect(target).toEqual({ type: 'final', boss, index: floors.length })
          } else {
            expect(target).toBeNull()
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('lays out a path that winds up and down across columns of a fixed pitch', () => {
    const layout = layoutFloors(8, 500)
    expect(layout.points).toHaveLength(8)
    expect(layout.pitch).toBe(COL_PITCH)
    expect(layout.width).toBeGreaterThanOrEqual(8 * COL_PITCH)
    // x advances by exactly one pitch per node; y waves.
    for (let i = 1; i < layout.points.length; i += 1) {
      expect(layout.points[i].x - layout.points[i - 1].x).toBe(COL_PITCH)
    }
    expect(new Set(layout.points.map((p) => Math.round(p.y))).size).toBeGreaterThan(2)
    const { padTop, finalR, amp } = layout.metrics
    for (const p of layout.points) {
      expect(p.y).toBeGreaterThanOrEqual(padTop + finalR)
      expect(p.y).toBeLessThanOrEqual(padTop + finalR + 2 * amp)
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(layout.width)
    }
  })

  it('keeps a full card inside the map height the layout asks for, and widens a short path to the viewport', () => {
    for (const h of [300, 450, 500, 650, 900, 1300]) {
      const m = layoutFloors(5, h).metrics
      expect(m.minHeight).toBeGreaterThan(m.padTop + 2 * m.finalR + 2 * m.amp)
      if (h >= m.minHeight) expect(m.padTop + 2 * m.finalR + 2 * m.amp).toBeLessThan(h)
    }
    // 4 nodes on a 1366 px map fill the width; 25 nodes keep the base pitch.
    expect(fitPitch(4, 1366, 500) * 4 + 2 * PAD_X).toBeLessThanOrEqual(1366)
    expect(fitPitch(4, 1366, 500)).toBeGreaterThan(COL_PITCH)
    expect(fitPitch(26, 1366, 500)).toBe(COL_PITCH)
  })

  it('draws each path segment horizontally between two seal centres', () => {
    const [a, b] = layoutFloors(2, 500).points
    const d = segmentPath(a, b)
    expect(d.startsWith(`M ${a.x} ${Math.round(a.y * 10) / 10} C`)).toBe(true)
    expect(d.endsWith(`${b.x} ${Math.round(b.y * 10) / 10}`)).toBe(true)
  })
})
