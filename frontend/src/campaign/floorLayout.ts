import type { FinalBoss, Floor } from '../types/api'

/**
 * Pure floor map logic (D2). No React, no DOM. The map runs left to right: columns have a fixed
 * pitch so the window of rendered nodes can be computed from the horizontal scroll offset alone.
 */
export const COL_PITCH = 248
/** The widest a column grows when there are few floors and the map would otherwise leave empty space. */
export const MAX_COL_PITCH = 340
export const OVERSCAN_COLS = 2
/** Up to this many nodes everything renders (no windowing). */
export const RENDER_ALL_UP_TO = 12
export const PAGE_STEP = 5
/** Room at both ends of the path so halos and focus rings are never clipped by the scroller. */
export const PAD_X = 28
/** Gap between the seal and the floor card under it. */
export const CARD_GAP = 10

export interface NodePoint {
  /** Horizontal centre of the column, relative to the left edge of the map. */
  x: number
  /** Vertical centre of the seal. */
  y: number
}

export interface MapMetrics {
  sealR: number
  finalR: number
  /** Peak-to-peak wave is `2 * amp`. */
  amp: number
  padTop: number
  /** How many topic rows a card shows before "+N more". */
  topicRows: number
  /** The least height the map needs so that a full card fits under the lowest seal. */
  minHeight: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Sizes that scale with the height the map has been given. */
export function mapMetrics(height: number): MapMetrics {
  const h = Math.max(0, height)
  const sealR = clamp(Math.round(h * 0.085), 26, 56)
  const finalR = Math.round(sealR * 1.2)
  const amp = clamp(Math.round(h * 0.05), 6, 48)
  const topicRows = h >= 760 ? 4 : h >= 430 ? 3 : h >= 350 ? 2 : 1
  const top = 18
  // seal diameter + wave + gap + a card with its chrome and its topic rows (about 30 px a row) + "+N more" + breathing room.
  const cardEstimate = 150 + topicRows * 30 + 30
  const minHeight = top + 2 * finalR + 2 * amp + CARD_GAP + cardEstimate + 16
  // Spare height moves the whole path down a little so a tall window is not top-heavy.
  const padTop = top + Math.round(Math.max(0, h - minHeight) * 0.3)
  return { sealR, finalR, amp, padTop, topicRows, minHeight }
}

export interface MapLayout {
  points: NodePoint[]
  /** Total width of the map, padding included. */
  width: number
  pitch: number
  metrics: MapMetrics
}

/**
 * Column pitch: `COL_PITCH` on a short map, a little wider on a tall one, and widened (up to
 * `MAX_COL_PITCH`) so a short path spans the whole width instead of leaving the right side empty.
 */
export function fitPitch(count: number, viewportW: number, viewportH: number = 0): number {
  const base = clamp(Math.round(viewportH * 0.32), COL_PITCH, 300)
  if (count <= 0 || viewportW <= 0) return base
  return clamp(Math.floor((viewportW - 2 * PAD_X - 2) / count), base, MAX_COL_PITCH)
}

/** Seal centres on a wave: `y = top + amp * (1 + sin(i * 0.9))`, one column per node. */
export function layoutFloors(count: number, height: number, pitch: number = COL_PITCH): MapLayout {
  const n = Math.max(0, Math.floor(count))
  const metrics = mapMetrics(height)
  const base = metrics.padTop + metrics.finalR
  const points: NodePoint[] = Array.from({ length: n }, (_, i) => ({
    x: PAD_X + i * pitch + pitch / 2,
    y: base + metrics.amp * (1 + Math.sin(i * 0.9)),
  }))
  return { points, width: 2 * PAD_X + n * pitch, pitch, metrics }
}

export interface VisibleRange {
  /** First rendered index. */
  start: number
  /** One past the last rendered index. */
  end: number
}

/**
 * The window of columns to render. Column `i` covers `[i * pitch, (i + 1) * pitch)` in nodes-area
 * coordinates (the left padding already removed from `scrollLeft`). Every column that touches the
 * viewport, `overscan` columns around it, and the focused column are included; at most
 * `RENDER_ALL_UP_TO` nodes render everything.
 */
export function visibleRange(
  scrollLeft: number,
  viewportW: number,
  count: number,
  pitch: number = COL_PITCH,
  overscan: number = OVERSCAN_COLS,
  focusedIndex: number = -1,
): VisibleRange {
  if (count <= 0) return { start: 0, end: 0 }
  if (count <= RENDER_ALL_UP_TO) return { start: 0, end: count }
  const left = Math.max(0, scrollLeft)
  const w = Math.max(1, viewportW)
  const clampIndex = (i: number) => Math.min(count - 1, Math.max(0, i))
  const first = clampIndex(Math.floor(left / pitch))
  const last = clampIndex(Math.floor((left + w - 1) / pitch))
  let start = Math.max(0, first - overscan)
  let end = Math.min(count, last + overscan + 1)
  if (focusedIndex >= 0 && focusedIndex < count) {
    start = Math.min(start, focusedIndex)
    end = Math.max(end, focusedIndex + 1)
  }
  return { start, end }
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown'

export const NAV_KEYS: readonly NavKey[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]

export function isNavKey(key: string): key is NavKey {
  return (NAV_KEYS as readonly string[]).includes(key)
}

/** The next focused index for a navigation key, clamped to the range. -1 when there are no nodes. */
export function nextFocus(index: number, key: NavKey, count: number): number {
  if (count <= 0) return -1
  const last = count - 1
  const cur = Math.min(last, Math.max(0, index))
  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(0, cur - 1)
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(last, cur + 1)
    case 'Home':
      return 0
    case 'End':
      return last
    case 'PageUp':
      return Math.max(0, cur - PAGE_STEP)
    case 'PageDown':
      return Math.min(last, cur + PAGE_STEP)
  }
}

export type PlayTarget =
  | { type: 'floor'; floor: Floor; index: number }
  | { type: 'final'; boss: FinalBoss; index: number }

/**
 * Continue target: the first `ready` Floor, else the Final_Boss when it is unlocked, else null.
 * `index` is the node index on the map (the Final_Boss sits after the last Floor).
 */
export function nextPlayable(floors: readonly Floor[], finalBoss?: FinalBoss | null): PlayTarget | null {
  const i = floors.findIndex((f) => f.status === 'ready')
  if (i >= 0) return { type: 'floor', floor: floors[i], index: i }
  if (finalBoss && finalBoss.unlocked) return { type: 'final', boss: finalBoss, index: floors.length }
  return null
}

/** One SVG path segment between two seal centres: a smooth horizontal S curve. */
export function segmentPath(a: NodePoint, b: NodePoint): string {
  const k = (b.x - a.x) * 0.55
  const r = (n: number) => Math.round(n * 10) / 10
  return `M ${r(a.x)} ${r(a.y)} C ${r(a.x + k)} ${r(a.y)} ${r(b.x - k)} ${r(b.y)} ${r(b.x)} ${r(b.y)}`
}

/** Path chunks hold this many segments so only chunks in range are rendered. */
export const PATH_CHUNK = 5

export function chunkRange(range: VisibleRange, segmentCount: number): { first: number; last: number } {
  if (segmentCount <= 0 || range.end <= range.start) return { first: 0, last: -1 }
  const first = Math.floor(Math.max(0, range.start - 1) / PATH_CHUNK)
  const last = Math.floor(Math.min(segmentCount - 1, range.end) / PATH_CHUNK)
  return { first, last }
}
