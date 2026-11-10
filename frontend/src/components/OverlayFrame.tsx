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
      className={`fixed inset-0 ${zClass} flex overflow-hidden bg-bg/85 p-[clamp(0.5rem,2vh,1rem)]`}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.25 }}
    >
      {backdrop}
      <motion.div
        className={`m-auto flex max-h-full min-h-0 w-full flex-col ${widthClass}`}
        initial={reduced ? false : { scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.25 }}
      >
        <StoneFrame className="flex min-h-0 flex-col p-1">
          <div className="flex min-h-0 flex-col rounded-md border border-deep px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.6rem,2.2vh,1.25rem)]">
            <div className="mb-[clamp(0.25rem,1vh,0.75rem)] shrink-0 text-center">
              <h2 id={titleId} className="font-(family-name:--font-display) text-[clamp(1.6rem,4.5vh,1.875rem)] leading-tight text-gold">
                {title}
              </h2>
            </div>
            <span aria-hidden="true" className="sd-bone-divider mb-[clamp(0.25rem,1vh,0.75rem)] shrink-0" />
            <div className="sd-overlay-body flex min-h-0 flex-col items-center gap-[clamp(0.5rem,1.6vh,1rem)] overflow-y-auto text-center">
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
