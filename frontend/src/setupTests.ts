import { configure } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'

/**
 * The intro story shows once per browser (sd.introSeen, sd.tutorialSeen). Every test starts as a returning visitor so flows that
 * click Try the Demo go straight to the map; the lore tests clear the flag to see the story.
 */
beforeEach(() => {
  try {
    localStorage.setItem('sd.introSeen', '1')
    localStorage.setItem('sd.tutorialSeen', '1')
  } catch {
    /* no storage in this environment */
  }
})

configure({ asyncUtilTimeout: 8000 })

/**
 * Cold lazy-chunk transforms in the first test of a file can exceed the 1 s default wait when the
 * whole suite runs in parallel. Raise the default for `vi.waitFor` only; tests that pass a
 * timeout keep it.
 */
const original = vi.waitFor.bind(vi)
vi.waitFor = ((callback: Parameters<typeof vi.waitFor>[0], options?: Parameters<typeof vi.waitFor>[1]) => {
  if (typeof options === 'number') return original(callback, options)
  return original(callback, { timeout: 8000, ...options })
}) as typeof vi.waitFor
