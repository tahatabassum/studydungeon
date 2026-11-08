import { useCallback, useEffect, useState } from 'react'
import { TYPEWRITER_RATE, visibleChars } from './typewriterMath'

interface TypeState {
  text: string
  elapsed: number
  skipped: boolean
}

const TICK_MS = 33

/** Reveals `text` at `rate` chars per second. Resets when the text changes. Instant when reduced. */
export function useTypewriter(text: string, reduced: boolean, enabled = true, rate = TYPEWRITER_RATE) {
  const [st, setSt] = useState<TypeState>({ text, elapsed: 0, skipped: false })
  const cur = st.text === text ? st : { text, elapsed: 0, skipped: false }
  const count = enabled ? visibleChars(text.length, rate, cur.elapsed, cur.skipped, reduced) : 0
  const done = enabled && count >= text.length

  useEffect(() => {
    if (!enabled || done) return
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      setSt((p) => (p.text === text ? { ...p, elapsed } : { text, elapsed, skipped: false }))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [enabled, done, text])

  const skip = useCallback(() => {
    setSt((p) => ({ text, elapsed: p.text === text ? p.elapsed : 0, skipped: true }))
  }, [text])

  return { visible: text.slice(0, count), rest: text.slice(count), done, skip }
}
