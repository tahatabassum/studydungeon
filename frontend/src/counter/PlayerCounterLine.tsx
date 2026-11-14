import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { getApi } from '../api'
import { fetchPlayerCount } from './cache'
import { COUNT_UP_MS, countUpValue } from './countUp'
import { formatExplorerLine } from './format'

const NUMBER_RE = /[\d,]+/
const nf = new Intl.NumberFormat('en-US')

/**
 * Title-screen player counter (D21). Renders nothing until a valid number arrives, takes no layout space
 * (absolutely placed in a zero-height box) and fades in, so it never moves the Try the Demo button.
 */
export function PlayerCounterLine() {
  const reduce = useReducedMotion() ?? false
  const [count, setCount] = useState<number | null>(null)
  const [shown, setShown] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    void getApi()
      .then((api) => fetchPlayerCount(api))
      .then((n) => {
        if (live) setCount(n)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const animate = !reduce && count !== null && count >= 10 && typeof requestAnimationFrame === 'function'
  useEffect(() => {
    if (!animate || count === null) return
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const v = countUpValue(now - start, COUNT_UP_MS, count, false)
      setShown(v)
      raf.current = v < count ? requestAnimationFrame(step) : null
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [animate, count])
  const finalText = formatExplorerLine(count)
  if (finalText === null || count === null) return null
  // While counting the digits climb inside the same sentence; at rest the exact final text shows.
  const visible = animate && shown < count ? finalText.replace(NUMBER_RE, nf.format(shown)) : finalText
  return (
    <div className="sd-counter" data-testid="player-counter">
      <p className="sd-counter__line font-(family-name:--font-label)">
        <span aria-hidden="true" data-testid="player-counter-visual">
          {visible}
        </span>
        <span className="sr-only">{finalText}</span>
      </p>
    </div>
  )
}
