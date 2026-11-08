import { useCallback, useEffect, useRef, useState } from 'react'

export const FULLSCREEN_FAILED_MESSAGE = 'Fullscreen is not available right now. Staying in the window.'

/** True when keyboard shortcuts must not fire because the user is typing. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Fullscreen toggle for the whole page. The F key and the button share `toggle`.
 * A rejected or unsupported request keeps the layout and sets a short `message`
 * for an aria-live region.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)

  const toggle = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        const el = document.documentElement
        if (typeof el.requestFullscreen !== 'function') throw new Error('unsupported')
        await el.requestFullscreen()
      }
      setMessage('')
    } catch {
      setMessage(FULLSCREEN_FAILED_MESSAGE)
    } finally {
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null)
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'f' && e.key !== 'F') || e.repeat) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
      e.preventDefault()
      void toggle()
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey)
    }
  }, [toggle])

  return { isFullscreen, message, toggle }
}
