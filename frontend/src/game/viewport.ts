/**
 * Viewport_Helper: pure, Phaser-free layout math for the full-viewport canvas.
 * With Phaser.Scale.RESIZE the canvas equals the viewport, so the camera zoom
 * (not the canvas size) decides how much world is visible.
 */

/** Design view size: the 960x540 world window that zoom 1.0 used to show. */
export const BASE_W = 960
export const BASE_H = 540

export const MIN_ZOOM = 0.75
export const MAX_ZOOM = 3

/** Below this width the HUD collapses to its compact bar. */
export const COMPACT_BELOW = 640

/** Height (px) of the floating HUD top bar and bottom legend, and the side gutters. */
export const HUD_TOP_H = 56
export const HUD_BOTTOM_H = 40
export const HUD_SIDE_GUTTER = 16

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type LayoutClass = 'phone' | 'tablet' | 'desktop' | 'wide'
export type HudMode = 'compact' | 'full'

/** D2: zoom = clamp(snapQuarter(min(w/960, h/540)), 0.75, 3.0). */
export function zoomForViewport(w: number, h: number): number {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return MIN_ZOOM
  const fit = Math.min(w / BASE_W, h / BASE_H)
  const snapped = Math.round(fit * 4) / 4
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, snapped))
}

export function layoutClass(w: number, h: number): LayoutClass {
  // A landscape phone is narrow in height, so it is a phone too.
  if (w < COMPACT_BELOW || h < 400) return 'phone'
  if (w < 1024) return 'tablet'
  if (w < 1920) return 'desktop'
  return 'wide'
}

export function hudMode(w: number): HudMode {
  return w < COMPACT_BELOW ? 'compact' : 'full'
}

/** The four rectangles the floating HUD may occupy (top bar, bottom legend, two gutters). */
export function hudRects(w: number, h: number): readonly [Rect, Rect, Rect, Rect] {
  return [
    { x: 0, y: 0, w, h: HUD_TOP_H },
    { x: 0, y: Math.max(0, h - HUD_BOTTOM_H), w, h: HUD_BOTTOM_H },
    { x: 0, y: HUD_TOP_H, w: HUD_SIDE_GUTTER, h: Math.max(0, h - HUD_TOP_H - HUD_BOTTOM_H) },
    { x: Math.max(0, w - HUD_SIDE_GUTTER), y: HUD_TOP_H, w: HUD_SIDE_GUTTER, h: Math.max(0, h - HUD_TOP_H - HUD_BOTTOM_H) },
  ]
}

/** Screen rectangle (viewport px) where the player and active monster must stay visible. */
export function hudSafeBand(w: number, h: number): Rect {
  return {
    x: HUD_SIDE_GUTTER,
    y: HUD_TOP_H,
    w: Math.max(1, w - 2 * HUD_SIDE_GUTTER),
    h: Math.max(1, h - HUD_TOP_H - HUD_BOTTOM_H),
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * Where a screen-space (scrollFactor 0) object must sit and how big it must be, in the
 * object's own coordinates, to cover the whole viewport at the given camera zoom.
 * Phaser zooms about the viewport centre, so screen s maps to (s - c) / zoom + c.
 */
export function overlayRect(w: number, h: number, zoom: number): Rect {
  const z = zoom > 0 ? zoom : 1
  return { x: w / 2 - w / (2 * z), y: h / 2 - h / (2 * z), w: w / z, h: h / z }
}
