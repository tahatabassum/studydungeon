import { useEffect, useRef, useState } from 'react'
import { Hourglass } from 'lucide-react'
import '../styles/haunt.css'
import { useReducedMotion } from '../state/useReducedMotion'
import { MILESTONE_TEXT, formatClock, milestoneCrossed, remainingSeconds } from './examClock'

export interface ExamTimerProps {
  /** Length in minutes. The timer exists only when the player chose one. */
  minutes: number
  /** Called once, when the clock reaches zero. */
  onExpire(): void
  /** Clock source; tests pass a fake. Default Date.now. */
  now?: () => number
}

/**
 * The optional Exam countdown. It shows the time left, announces politely at 5 minutes and at 1 minute
 * (and nowhere else, so it does not chatter), only pulses near the end when motion is allowed, and calls
 * `onExpire` at zero.
 */
export function ExamTimer({ minutes, onExpire, now = Date.now }: ExamTimerProps) {
  const reduced = useReducedMotion()
  const [deadline] = useState(() => now() + minutes * 60_000)
  const [left, setLeft] = useState(() => remainingSeconds(deadline, now()))
  const [announcement, setAnnouncement] = useState('')
  const previous = useRef(left)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    const id = setInterval(() => {
      const next = remainingSeconds(deadline, now())
      const mark = milestoneCrossed(previous.current, next)
      previous.current = next
      setLeft(next)
      if (mark) setAnnouncement(MILESTONE_TEXT[mark])
      if (next <= 0 && !expired.current) {
        expired.current = true
        clearInterval(id)
        onExpireRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [deadline, now])

  const low = left <= 60
  return (
    <div className="sd-exam-timer" data-testid="exam-timer" data-low={low && !reduced ? 'true' : undefined}>
      <Hourglass aria-hidden="true" size={16} />
      <span>
        <span className="sr-only">Time left: </span>
        {formatClock(left)}
      </span>
      <span role="status" aria-live="polite" className="sr-only" data-testid="exam-timer-live">
        {announcement}
      </span>
    </div>
  )
}
