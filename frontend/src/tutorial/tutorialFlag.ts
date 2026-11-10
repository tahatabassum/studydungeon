import { hasSeenIntro, INTRO_FLAG_KEY, markIntroSeen, TUTORIAL_FLAG_KEY } from '../lore/intro'

/**
 * First-run flags (frontend-08 D14). `sd.tutorialSeen` marks the interactive tutorial as done or skipped.
 * The merged first-run flow (intro cards, then the tutorial steps) also writes `sd.introSeen`, so a skip
 * at any step counts the whole first run as seen. Both hold the string "1": UI state only, no token,
 * no progress, nothing secret.
 */
export { INTRO_FLAG_KEY, TUTORIAL_FLAG_KEY }

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** True once the tutorial was finished or skipped in this browser. Storage that throws counts as "not seen". */
export function hasSeenTutorial(): boolean {
  try {
    return storage()?.getItem(TUTORIAL_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** Remembers the tutorial as seen and, with it, the intro. A blocked storage is ignored. */
export function markTutorialSeen(): void {
  markIntroSeen()
  try {
    storage()?.setItem(TUTORIAL_FLAG_KEY, '1')
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/** True while any part of the first-run flow (intro or tutorial) has not been seen yet. */
export function needsFirstRun(): boolean {
  return !hasSeenIntro() || !hasSeenTutorial()
}
