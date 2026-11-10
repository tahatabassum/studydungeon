/**
 * Intro story data and its once-per-browser flag (frontend-07 D22, Req 15.4).
 *
 * FIRST-RUN HOOK for frontend-08 Phase 6 (task 13.2): `IntroStory` is a self-contained step. It never reads or
 * writes the flag itself; it only calls `onDone`. The tutorial flow composes it as step zero:
 *
 *   if (!hasSeenIntro()) show <IntroStory onDone={() => { markIntroSeen(); next() }} />
 *   then run the tutorial steps and call markTutorialSeen() (`sd.tutorialSeen`, frontend-08 D14).
 *
 * Both flags hold the string "1": no token, no progress, nothing secret.
 */
export const INTRO_FLAG_KEY = 'sd.introSeen'
/** Written by the frontend-08 tutorial (D14). Declared here so the merged first-run flow has one place for both keys. */
export const TUTORIAL_FLAG_KEY = 'sd.tutorialSeen'

export type IntroIllustration = 'warden' | 'ghost' | 'quiz' | 'lantern'

export interface IntroCard {
  id: string
  title: string
  /** One or two short sentences. Funny-spooky, never gory. */
  text: string
  art: IntroIllustration
}

/** Four short cards. Original StudyDungeon lore: the Exam Warden and the haunted notes. */
export const INTRO_CARDS: readonly IntroCard[] = Object.freeze([
  {
    id: 'warden',
    title: 'The Exam Warden',
    text: 'Deep under the library sleeps the Exam Warden, keeper of every pop quiz ever written. He has not had a visitor since the last bake sale.',
    art: 'warden',
  },
  {
    id: 'haunted',
    title: 'Your notes are haunted',
    text: 'Late one night your notes sat up, grew a sheet and started to wail. Now every page hides a monster, and each one is a little offended you forgot it.',
    art: 'ghost',
  },
  {
    id: 'questions',
    title: 'Monsters ask questions',
    text: 'They do not bite. They quiz. Answer right and your weapon lands a blow. Answer wrong and you lose a little courage, then you get a second chance.',
    art: 'quiz',
  },
  {
    id: 'lantern',
    title: 'Take the lantern',
    text: 'Clear each floor, lay the restless memories to rest and face the Warden. Bring snacks. The crypt is drafty.',
    art: 'lantern',
  },
] satisfies readonly IntroCard[])

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** True once the intro was finished or skipped in this browser. Storage that throws counts as "not seen". */
export function hasSeenIntro(): boolean {
  try {
    return storage()?.getItem(INTRO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** Remembers that the intro was seen. A blocked storage is ignored (the story may then show again). */
export function markIntroSeen(): void {
  try {
    storage()?.setItem(INTRO_FLAG_KEY, '1')
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
