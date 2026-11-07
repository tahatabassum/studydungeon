import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureFontsLoaded, waitForFonts } from './fonts'

describe('waitForFonts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves loaded before the timeout', async () => {
    await expect(waitForFonts(Promise.resolve(), 1500)).resolves.toBe('loaded')
  })

  it('resolves timeout when ready never resolves', async () => {
    const p = waitForFonts(new Promise(() => {}), 1500)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(p).resolves.toBe('timeout')
  })

  it('resolves unavailable for undefined and rejecting promises', async () => {
    await expect(waitForFonts(undefined)).resolves.toBe('unavailable')
    await expect(waitForFonts(Promise.reject(new Error('x')))).resolves.toBe('unavailable')
  })

  it('clears its timer after load', async () => {
    await waitForFonts(Promise.resolve(), 1500)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('ensureFontsLoaded', () => {
  it('does not throw without document.fonts', async () => {
    await expect(ensureFontsLoaded({} as Document)).resolves.toBeUndefined()
  })

  it('does not throw when load rejects', async () => {
    const doc = { fonts: { load: () => Promise.reject(new Error('x')) } } as unknown as Document
    await expect(ensureFontsLoaded(doc)).resolves.toBeUndefined()
  })
})
