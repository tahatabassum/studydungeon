import { useEffect, useState } from 'react'

/** True when the URL asks for touch controls on a desktop (dev override): `?touch=1`. */
export const TOUCH_OVERRIDE_KEY = 'sd.touch'

export function touchOverride(search: string = typeof window === 'undefined' ? '' : window.location.search): boolean {
  try {
    if (new URLSearchParams(search).get('touch') === '1') {
      // Remembered for the tab, because in-app navigation drops the query string.
      sessionStorage.setItem(TOUCH_OVERRIDE_KEY, '1')
      return true
    }
    return sessionStorage.getItem(TOUCH_OVERRIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** True when the primary pointer is coarse (a finger), by media query. Safe without matchMedia. */
export function hasCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

/**
 * Touch mode: on for a coarse primary pointer, after the first touchstart, or with `?touch=1`.
 * Desktop with a mouse and keyboard stays off, so nothing changes there.
 */
export function useTouchMode(): boolean {
  const [touch, setTouch] = useState<boolean>(() => touchOverride() || hasCoarsePointer())

  useEffect(() => {
    if (touch) return
    const on = (): void => setTouch(true)
    window.addEventListener('touchstart', on, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', on)
  }, [touch])

  // Lets CSS enlarge touch targets for `?touch=1` and first-touch too (not only a coarse pointer).
  useEffect(() => {
    const root = document.documentElement
    if (touch) root.dataset.touch = 'true'
    else delete root.dataset.touch
  }, [touch])

  return touch
}
