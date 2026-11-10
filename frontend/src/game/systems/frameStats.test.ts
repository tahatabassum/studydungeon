import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

describe('FrameStats', () => {
  it('reports zeros when empty and ignores bad frame times', () => {
    const s = new FrameStats()
    s.push(0)
    s.push(-3)
    s.push(Number.NaN)
    expect(s.report()).toEqual({ frames: 0, spanMs: 0, avgFps: 0, low1Fps: 0 })
  })

  it('a steady 60 fps gives 60 average and 60 low', () => {
    const s = new FrameStats()
    for (let i = 0; i < 600; i++) s.push(1000 / 60)
    const r = s.report()
    expect(r.avgFps).toBeCloseTo(60, 3)
    expect(r.low1Fps).toBeCloseTo(60, 3)
  })

  it('the 1% low reflects the slowest frames', () => {
    const s = new FrameStats()
    for (let i = 0; i < 990; i++) s.push(10)
    for (let i = 0; i < 10; i++) s.push(50)
    const r = s.report(1_000_000)
    expect(r.low1Fps).toBeCloseTo(20, 3)
    expect(r.avgFps).toBeGreaterThan(r.low1Fps)
  })

  it('only the most recent window counts', () => {
    const s = new FrameStats()
    for (let i = 0; i < 2000; i++) s.push(100)
    for (let i = 0; i < 1000; i++) s.push(10)
    const r = s.report(10_000)
    expect(r.avgFps).toBeCloseTo(100, 3)
  })
})
