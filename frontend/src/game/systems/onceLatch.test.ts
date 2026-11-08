import { describe, expect, it, vi } from 'vitest'
import { createOnceLatch } from './onceLatch'

describe('createOnceLatch', () => {
  it('runs the action exactly once however often it is fired', () => {
    const emit = vi.fn()
    const latch = createOnceLatch(emit)
    expect(latch.fired).toBe(false)
    expect(latch.fire()).toBe(true)
    expect(latch.fire()).toBe(false)
    expect(latch.fire()).toBe(false)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(latch.fired).toBe(true)
  })

  it('gives each result its own latch', () => {
    const emit = vi.fn()
    createOnceLatch(emit).fire()
    createOnceLatch(emit).fire()
    expect(emit).toHaveBeenCalledTimes(2)
  })
})
