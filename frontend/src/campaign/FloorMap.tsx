import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutDashboard, X } from 'lucide-react'
import '../styles/landing.css'
import '../styles/campaign.css'
import { useReducedMotion } from '../state/useReducedMotion'
import type { FinalBoss, Floor, FloorStatus } from '../types/api'
import { FinalBossNode } from './FinalBossNode'
import { FloorNode } from './FloorNode'
import {
  COL_PITCH,
  OVERSCAN_COLS,
  PAD_X,
  PATH_CHUNK,
  chunkRange,
  fitPitch,
  layoutFloors,
  nextFocus,
  nextPlayable,
  segmentPath,
  visibleRange,
  type NavKey,
} from './floorLayout'

const DEFAULT_WIDTH = 1100
const DEFAULT_HEIGHT = 480
/** Scroll offsets are quantised to half a column in state so a scroll does not re-render on every pixel. */
const SCROLL_QUANT = COL_PITCH / 2
/** Smooth scroll to the Continue target takes about this long before the floor opens. */
const CONTINUE_DELAY_MS = 380
/** A pointer must move this far before a press becomes a drag (so a click stays a click). */
const DRAG_THRESHOLD = 6
/** Arrow buttons move the map by this share of its visible width. */
const PAGE_SHARE = 0.8

export interface FloorMapProps {
  /** Dungeon name. */
  title: string
  floors: readonly Floor[]
  finalBoss?: FinalBoss | null
  /** Campaign extras (floor count header, mastery rings, Final_Boss). False for a backend without floors. */
  extras?: boolean
  /** Live-region text from the generation poller. */
  announcement?: string
  errorMessage?: string | null
  onDismissError?(): void
  /** True after the poller gave up: shows a "taking longer than usual" notice. */
  timedOut?: boolean
  onResume?(): void
  /** Link back to the title screen. */
  backTo?: string
  /** Link to the Dashboard, shown in the top bar when given. */
  dashboardTo?: string
  onOpenFloor(floor: Floor): void
  onOpenFinal(boss: FinalBoss): void
  onRetryFloor(floor: Floor): void
  /** Extra controls in the toolbar row (the Daily Haunt button and the practice modes). */
  headerTools?: ReactNode
}

type SegmentState = 'done' | 'active' | 'pending' | 'broken' | 'dim'

const SEGMENT_OF: Record<FloorStatus, SegmentState> = {
  cleared: 'done',
  ready: 'active',
  generating: 'pending',
  failed: 'broken',
  locked: 'dim',
}

function continueHint(floors: readonly Floor[], hasFinal: boolean, target: ReturnType<typeof nextPlayable>): string {
  if (target?.type === 'floor') return `Next: Floor ${target.floor.index}, ${target.floor.title}`
  if (target?.type === 'final') return `Next: ${target.boss.name}`
  if (floors.some((f) => f.status === 'generating')) return 'Floors are still being summoned.'
  if (floors.some((f) => f.status === 'failed')) return 'A floor failed. Retry it to go on.'
  if (floors.length > 0 && floors.every((f) => f.status === 'cleared')) {
    return hasFinal ? 'The final boss is locked.' : 'Every floor is cleared.'
  }
  return 'No floor is ready yet.'
}

interface DragState {
  id: number
  startX: number
  startLeft: number
  next: number
  moved: boolean
  raf: number | null
}

/** The campaign map: a winding glowing path of floor cards from left to right, windowed for long dungeons. */
export function FloorMap({
  title,
  floors,
  finalBoss = null,
  extras = true,
  announcement = '',
  errorMessage = null,
  onDismissError,
  timedOut = false,
  onResume,
  backTo,
  dashboardTo,
  onOpenFloor,
  onOpenFinal,
  onRetryFloor,
  headerTools,
}: FloorMapProps) {
  const reduced = useReducedMotion()
  const showFinal = extras && finalBoss !== null
  const total = floors.length + (showFinal ? 1 : 0)
  const target = useMemo(() => nextPlayable(floors, showFinal ? finalBoss : null), [floors, finalBoss, showFinal])

  const scrollerRef = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const pendingFocus = useRef<number | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<DragState | null>(null)
  const swallowClick = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scrollLeft, setScrollLeft] = useState(0)
  const [edges, setEdges] = useState({ overflow: false, atStart: true, atEnd: true })
  const [focusIndex, setFocusIndex] = useState(() => target?.index ?? 0)
  const [notice, setNotice] = useState('')

  const viewportW = size.w || DEFAULT_WIDTH
  const viewportH = size.h || DEFAULT_HEIGHT
  const pitch = fitPitch(total, viewportW, viewportH)
  const layout = useMemo(() => layoutFloors(total, viewportH, pitch), [total, viewportH, pitch])
  const colH = Math.max(viewportH, layout.metrics.minHeight)
  const range = visibleRange(scrollLeft - PAD_X, viewportW, total, pitch, OVERSCAN_COLS, focusIndex)

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const next = { overflow: max > 1, atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 }
    setEdges((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next,
    )
  }, [])

  // Measure the scroller (ResizeObserver where available).
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const measure = () => {
      setSize((prev) => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }))
      syncEdges()
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncEdges])

  // The content width changes with the floor count and the pitch.
  useEffect(() => {
    syncEdges()
  }, [layout.width, syncEdges])

  const scrollToLeft = useCallback(
    (left: number, smooth: boolean) => {
      const el = scrollerRef.current
      if (!el) return
      const w = el.clientWidth || viewportW
      const clamped = Math.min(Math.max(0, layout.width - w), Math.max(0, left))
      // A long jump (Home, End, a far Continue) is instant: smooth scrolling across many unrendered columns would show blanks.
      const far = Math.abs(clamped - el.scrollLeft) > Math.max(w, DEFAULT_WIDTH) * 1.25
      const animate = smooth && !reduced && !far
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left: clamped, behavior: animate ? 'smooth' : ('instant' as ScrollBehavior) })
      } else {
        el.scrollLeft = clamped
      }
      // Follow the jump right away; scroll events keep the window in step during a smooth scroll.
      if (!animate) setScrollLeft(Math.round(clamped / SCROLL_QUANT) * SCROLL_QUANT)
    },
    [layout.width, reduced, viewportW],
  )

  /** Scrolls so that column `index` is centred when it is not already fully in view. */
  const revealIndex = useCallback(
    (index: number, smooth: boolean, force = false) => {
      const colLeft = PAD_X + index * pitch
      const el = scrollerRef.current
      const left = el ? el.scrollLeft : scrollLeft
      const w = el && el.clientWidth > 0 ? el.clientWidth : viewportW
      const inView = colLeft >= left && colLeft + pitch <= left + w
      if (force || !inView) scrollToLeft(colLeft + pitch / 2 - w / 2, smooth)
    },
    [pitch, scrollLeft, scrollToLeft, viewportW],
  )

  // Start at the next playable floor.
  const didInitialScroll = useRef(false)
  useEffect(() => {
    if (didInitialScroll.current || total === 0) return
    didInitialScroll.current = true
    if (target && PAD_X + target.index * pitch + pitch > viewportW) revealIndex(target.index, false, true)
  }, [pitch, revealIndex, target, total, viewportW])

  useEffect(
    () => () => {
      if (openTimer.current !== null) clearTimeout(openTimer.current)
      const d = drag.current
      if (d && d.raf !== null) cancelAnimationFrame(d.raf)
    },
    [],
  )

  // Move DOM focus after a keyboard move once the target node is rendered.
  useLayoutEffect(() => {
    const wanted = pendingFocus.current
    if (wanted === null) return
    const el = buttons.current.get(wanted)
    if (el) {
      el.focus({ preventScroll: true })
      pendingFocus.current = null
    }
  })

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const q = Math.round(el.scrollLeft / SCROLL_QUANT) * SCROLL_QUANT
    setScrollLeft((prev) => (prev === q ? prev : q))
    syncEdges()
  }, [syncEdges])

  // A plain mouse wheel pans the map sideways when it has nothing to scroll vertically (shift+wheel and
  // horizontal wheels already work natively). Needs a non-passive listener to cancel the default.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el.scrollWidth <= el.clientWidth) return
      if (!e.shiftKey && el.scrollHeight > el.clientHeight + 1) return
      e.preventDefault()
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pointer drag (mouse and pen; touch scrolls natively). scrollLeft is written once per animation frame.
  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = scrollerRef.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (d.raf !== null) {
      cancelAnimationFrame(d.raf)
      if (el) el.scrollLeft = d.next
    }
    if (el) {
      delete el.dataset.dragging
      if (el.hasPointerCapture?.(d.id)) el.releasePointerCapture(d.id)
    }
    if (d.moved) {
      // The click that follows this release must not open the node under the pointer.
      swallowClick.current = true
      setTimeout(() => {
        swallowClick.current = false
      }, 0)
    }
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    // The custom drag is for a mouse only; touch and pen keep native scrolling and snap.
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
    swallowClick.current = false
    drag.current = { id: e.pointerId, startX: e.clientX, startLeft: el.scrollLeft, next: el.scrollLeft, moved: false, raf: null }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = scrollerRef.current
    if (!d || !el || e.pointerId !== d.id) return
    const dx = e.clientX - d.startX
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return
      d.moved = true
      el.dataset.dragging = 'true'
      el.setPointerCapture?.(e.pointerId)
    }
    d.next = d.startLeft - dx
    if (d.raf === null) {
      d.raf = requestAnimationFrame(() => {
        d.raf = null
        el.scrollLeft = d.next
      })
    }
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  const page = useCallback(
    (dir: -1 | 1) => {
      const el = scrollerRef.current
      if (!el) return
      scrollToLeft(el.scrollLeft + dir * el.clientWidth * PAGE_SHARE, true)
    },
    [scrollToLeft],
  )

  const registerButton = useCallback((index: number, el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(index, el)
    else buttons.current.delete(index)
  }, [])

  const onFocusNode = useCallback(
    (index: number) => {
      setFocusIndex(index)
      revealIndex(index, true)
    },
    [revealIndex],
  )

  const onNavigate = useCallback(
    (index: number, key: NavKey) => {
      const next = nextFocus(index, key, total)
      if (next < 0) return
      pendingFocus.current = next
      setFocusIndex(next)
      revealIndex(next, true)
    },
    [revealIndex, total],
  )

  // A notice ("Floor 3 is locked") fades from the header after a few seconds.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const announceNotice = useCallback((text: string) => setNotice(text), [])

  const activateFloor = useCallback(
    (floor: Floor, index: number) => {
      setFocusIndex(index)
      if (floor.status === 'ready' || floor.status === 'cleared') {
        setNotice('')
        onOpenFloor(floor)
      } else if (floor.status === 'failed') {
        onRetryFloor(floor)
      } else if (floor.status === 'generating') {
        announceNotice(`Floor ${floor.index} is being summoned...`)
      } else {
        announceNotice(
          floor.index > 1 ? `Floor ${floor.index} is locked. Clear Floor ${floor.index - 1} first.` : `Floor ${floor.index} is locked.`,
        )
      }
    },
    [announceNotice, onOpenFloor, onRetryFloor],
  )

  const activateFinal = useCallback(
    (boss: FinalBoss, index: number) => {
      setFocusIndex(index)
      if (boss.unlocked) {
        setNotice('')
        onOpenFinal(boss)
      } else {
        announceNotice(`${boss.name} is locked until every floor is cleared.`)
      }
    },
    [announceNotice, onOpenFinal],
  )

  const onContinue = useCallback(() => {
    if (!target) return
    setFocusIndex(target.index)
    pendingFocus.current = target.index
    revealIndex(target.index, true, true)
    if (openTimer.current !== null) clearTimeout(openTimer.current)
    const open = () => {
      openTimer.current = null
      if (target.type === 'floor') onOpenFloor(target.floor)
      else onOpenFinal(target.boss)
    }
    if (reduced) open()
    else openTimer.current = setTimeout(open, CONTINUE_DELAY_MS)
  }, [onOpenFinal, onOpenFloor, reduced, revealIndex, target])

  const statusAt = (i: number): FloorStatus =>
    i < floors.length ? floors[i].status : finalBoss?.unlocked ? 'ready' : 'locked'

  // Path chunks that intersect the rendered columns.
  const segmentCount = Math.max(0, total - 1)
  const chunks = chunkRange(range, segmentCount)
  const chunkNodes: ReactElement[] = []
  for (let c = chunks.first; c <= chunks.last; c += 1) {
    const segs: ReactElement[] = []
    for (let i = c * PATH_CHUNK; i < Math.min(segmentCount, (c + 1) * PATH_CHUNK); i += 1) {
      const d = segmentPath(layout.points[i], layout.points[i + 1])
      const state = SEGMENT_OF[statusAt(i + 1)]
      segs.push(
        <g key={i}>
          <path d={d} className="sd-path sd-path--halo" data-state={state} />
          <path d={d} className="sd-path sd-path--core" data-state={state} />
          <path d={d} className="sd-path sd-path--spark" data-state={state} />
        </g>,
      )
    }
    chunkNodes.push(<g key={c}>{segs}</g>)
  }

  const { sealR, finalR, topicRows } = layout.metrics
  const nodes: ReactElement[] = []
  for (let i = range.start; i < range.end; i += 1) {
    const { x, y } = layout.points[i]
    if (i < floors.length) {
      nodes.push(
        <FloorNode
          key={floors[i].id}
          floor={floors[i]}
          index={i}
          setSize={total}
          x={x}
          spot={{ pitch, y, r: sealR }}
          topicRows={topicRows}
          focused={focusIndex === i}
          extras={extras}
          registerButton={registerButton}
          onFocusNode={onFocusNode}
          onNavigate={onNavigate}
          onActivate={activateFloor}
          onRetry={onRetryFloor}
        />,
      )
    } else if (finalBoss) {
      nodes.push(
        <FinalBossNode
          key={`final-${finalBoss.id}`}
          boss={finalBoss}
          index={i}
          setSize={total}
          x={x}
          spot={{ pitch, y, r: finalR }}
          focused={focusIndex === i}
          registerButton={registerButton}
          onFocusNode={onFocusNode}
          onNavigate={onNavigate}
          onActivate={activateFinal}
        />,
      )
    }
  }

  const clearedCount = floors.filter((f) => f.status === 'cleared').length
  const heading = extras
    ? floors.length > 0
      ? `Your notes became ${floors.length} ${floors.length === 1 ? 'floor' : 'floors'}`
      : 'Your notes are not ready yet'
    : title
  const sub = extras
    ? floors.length > 0
      ? `${title}. ${clearedCount} of ${floors.length} ${floors.length === 1 ? 'floor' : 'floors'} cleared.`
      : title
    : floors.length === 1
      ? `One floor: ${floors[0].title}.`
      : ''
  const hint = continueHint(floors, showFinal, target)

  return (
    <main className="sd-map sd-sky" data-reduced={reduced ? 'true' : undefined} aria-labelledby="map-title">
      <div aria-hidden="true" className="sd-map__atmosphere">
        <div className="sd-moon" />
        <div className="sd-fog sd-fog--a" />
        <div className="sd-map__vignette" />
      </div>

      <header className="sd-map__header">
        <div className="sd-map__lead">
          {backTo ? (
            <Link to={backTo} className="sd-map__back">
              <ArrowLeft aria-hidden="true" size={16} />
              Title screen
            </Link>
          ) : null}
          <h1 id="map-title" className="sd-map__title">
            {heading}
          </h1>
          {sub && <p className="sd-map__sub">{sub}</p>}
        </div>
        <div className="sd-map__actions">
          {dashboardTo && (
            <Link to={dashboardTo} className="sd-map__back sd-map__dash">
              <LayoutDashboard aria-hidden="true" size={16} />
              Dashboard
            </Link>
          )}
          <button type="button" className="sd-map__continue" onClick={onContinue} disabled={!target} aria-describedby="map-continue-hint">
            Continue
          </button>
        </div>
      </header>

      <div className="sd-map__toolbar">
        {headerTools && (
          <div className="sd-map__tools" data-testid="map-tools">
            {headerTools}
          </div>
        )}
        <p id="map-continue-hint" className="sd-map__notice" data-testid="continue-hint">
          {notice || hint}
        </p>
      </div>

      {(errorMessage || timedOut) && (
        <div className="sd-map__alerts">
          {errorMessage && (
            <p role="alert" className="sd-map__alert" data-testid="map-error">
              <span className="flex-1">{errorMessage}</span>
              {onDismissError && (
                <button type="button" aria-label="Dismiss message" className="sd-control rounded p-1" onClick={onDismissError}>
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            </p>
          )}
          {timedOut && (
            <p role="status" className="sd-map__alert" data-testid="map-timeout">
              <span className="flex-1">Generation is taking longer than usual.</span>
              {onResume && (
                <button type="button" className="sd-fnode__retry" onClick={onResume}>
                  Retry
                </button>
              )}
            </p>
          )}
        </div>
      )}

      <div className="sd-map__stage" data-overflow={edges.overflow ? 'true' : 'false'}>
        <button
          type="button"
          className="sd-map__arrow sd-map__arrow--prev"
          aria-label="Scroll the map to earlier floors"
          disabled={edges.atStart}
          onClick={() => page(-1)}
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div
          ref={scrollerRef}
          className="sd-map__scroll"
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          data-testid="map-scroll"
        >
          {floors.length === 0 ? (
            <section className="sd-map__empty sd-stone" aria-label="No floors yet">
              <h2>Your notes are not ready yet</h2>
              <p className="text-ink-muted">The floors appear here as soon as your notes are turned into a dungeon.</p>
            </section>
          ) : (
            <div className="sd-map__col" style={{ width: layout.width, height: colH }}>
              <svg className="sd-map__svg" width={layout.width} height={colH} viewBox={`0 0 ${layout.width} ${colH}`} aria-hidden="true" data-testid="map-path">
                {chunkNodes}
              </svg>
              <ol className="sd-map__rows" aria-label="Floors">
                {nodes}
              </ol>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sd-map__arrow sd-map__arrow--next"
          aria-label="Scroll the map to later floors"
          disabled={edges.atEnd}
          onClick={() => page(1)}
        >
          <ChevronRight aria-hidden="true" size={22} />
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only" data-testid="map-live">
        {[announcement, notice].filter(Boolean).join(' ')}
      </div>
    </main>
  )
}
