import { useEffect, useRef } from 'react'
import { useTypewriter } from './useTypewriter'

export interface TypewriterProps {
  text: string
  reduced: boolean
  /** False holds the text back (nothing shown yet) until it becomes true. */
  enabled?: boolean
  className?: string
  onDone?: () => void
}

/**
 * Types `text` out. The full text is exposed to assistive technology from the first frame
 * (visually hidden copy); the animated copy is aria-hidden. Space, Enter or a click completes it.
 */
export function Typewriter({ text, reduced, enabled = true, className, onDone }: TypewriterProps) {
  const { visible, rest, done, skip } = useTypewriter(text, reduced, enabled)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    if (done) doneRef.current?.()
  }, [done])

  useEffect(() => {
    if (!enabled || done) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
      // A focused button handles Space and Enter itself.
      if (e.target instanceof HTMLElement && e.target.closest('button')) return
      e.preventDefault()
      skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, done, skip])

  return (
    <span className={className} onClick={done ? undefined : skip} data-typing={enabled && !done ? 'true' : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <span data-part="visible">{visible}</span>
        <span data-part="rest" className="opacity-0">
          {rest}
        </span>
      </span>
    </span>
  )
}
