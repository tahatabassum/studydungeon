import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { StoneFrame } from './StoneFrame'
import '../styles/hud.css'

export interface OverlayFrameProps {
  /** Heading text; rendered as an h2 with id `titleId`. */
  title: ReactNode
  titleId: string
  /** 'dialog' for informational overlays, 'alertdialog' for confirmations/defeat. */
  role?: 'dialog' | 'alertdialog'
  describedBy?: string
  /** Optional decorative character (aria-hidden) shown above the title. */
  character?: ReactNode
  /** Element (ref) or CSS selector inside the overlay that receives focus on mount. */
  initialFocus?: RefObject<HTMLElement | null> | string
  /** Element to focus on unmount. Defaults to the game container `[role="application"]`. */
  returnFocusTo?: HTMLElement | null
  /** When provided, Esc calls it (and the event does not propagate). */
  onEscape?(): void
  /** Tailwind z-index class for the backdrop. */
  zClass?: string
  /** Frame width class. */
  widthClass?: string
  /** Optional decorative layer (aria-hidden) rendered behind the frame. */
  backdrop?: ReactNode
  children: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Shared modal shell: backdrop, ornate frame, focus trap, focus return, fade/scale in. */
export function OverlayFrame({
  title,
  titleId,
  role = 'dialog',
  describedBy,
  character,
  initialFocus,
  returnFocusTo,
  onEscape,
  zClass = 'z-50',
  widthClass = 'max-w-md',
  backdrop,
  children,
}: OverlayFrameProps) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef(returnFocusTo)
  const initialRef = useRef(initialFocus)

  useEffect(() => {
    returnRef.current = returnFocusTo
  }, [returnFocusTo])

  useEffect(() => {
    const root = rootRef.current
    const init = initialRef.current
    const previous = document.activeElement as HTMLElement | null
    let target: HTMLElement | null | undefined
    if (typeof init === 'string') target = root?.querySelector<HTMLElement>(init)
    else if (init) target = init.current
    ;(target ?? root?.querySelector<HTMLElement>(FOCUSABLE))?.focus()
    return () => {
      const usable =
        previous && previous !== document.body && previous.isConnected ? previous : null
      const back =
        returnRef.current ?? usable ?? document.querySelector<HTMLElement>('[role="application"]')
      back?.focus()
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      e.stopPropagation()
      onEscape()
      return
    }
    if (e.key !== 'Tab') return
    const items = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!items || items.length === 0) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <motion.div
      ref={rootRef}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      data-reduced={reduced ? 'true' : undefined}
      className={`fixed inset-0 ${zClass} flex items-center justify-center overflow-y-auto bg-bg/85 p-4`}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.25 }}
    >
      {backdrop}
      <motion.div
        className={`w-full ${widthClass}`}
        initial={reduced ? false : { scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.25 }}
      >
        <StoneFrame className="p-1">
          <div className="rounded-md border border-deep px-6 py-5">
            <div className="mb-3 text-center">
              <h2 id={titleId} className="font-(family-name:--font-display) text-3xl text-gold">
                {title}
              </h2>
            </div>
            <span aria-hidden="true" className="sd-bone-divider mb-3" />
            <div className="flex flex-col items-center gap-4 text-center">
              {character && (
                <div aria-hidden="true" className="flex items-end justify-center gap-3">
                  {character}
                </div>
              )}
              {children}
            </div>
          </div>
        </StoneFrame>
      </motion.div>
    </motion.div>
  )
}
