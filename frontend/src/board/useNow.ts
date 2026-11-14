import { useEffect, useState } from 'react'

/** The current time in ms, ticking every second while the tab is visible (no timer while hidden). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }
    const start = () => {
      stop()
      setNow(Date.now())
      timer = setInterval(() => setNow(Date.now()), 1000)
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start())
    if (document.visibilityState !== 'hidden') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}
