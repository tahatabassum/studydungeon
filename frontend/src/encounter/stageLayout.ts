/**
 * Layout math for the encounter stage (portrait next to the speech panel). Pure numbers, no DOM.
 * It mirrors the CSS in src/styles/encounter.css so the geometry can be tested; keep both in step.
 */

export const REM = 16
/** How far the portrait box leans over the panel's outer edge. */
export const OVERLAP = 24
/** Panel border width. */
export const PANEL_BORDER = 3
/** Extra inner padding on the portrait side, beyond the overlap. */
export const PANEL_INNER_GAP = 12
/** Side padding of the encounter container. */
export const STAGE_PAD = 12
/** Below this width the portrait sits above the panel. */
export const PHONE_MAX = 639
export const PANEL_MAX_W = 46 * REM

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface StageLayout {
  mode: 'row' | 'column'
  portrait: Rect
  /** The panel's outer box. */
  panel: Rect
  /** The panel's content box (inside border and padding). */
  content: Rect
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

export function portraitHeight(vw: number, vh: number): number {
  return vw > PHONE_MAX ? clamp(Math.min(0.52 * vh, 0.44 * vw), 14 * REM, 30 * REM) : Math.min(0.3 * vh, 16 * REM)
}

/**
 * Rects for a viewport, with the panel's height supplied by the caller (it depends on its content).
 * The stage sits at the bottom, `bottom` px above the viewport edge.
 */
export function stageLayout(vw: number, vh: number, side: 'left' | 'right', panelH: number, bottom = 0): StageLayout {
  const ph = portraitHeight(vw, vh)
  const pw = 0.75 * ph
  const baseY = vh - bottom
  if (vw > PHONE_MAX) {
    const panelW = Math.min(PANEL_MAX_W, vw - 2 * STAGE_PAD - pw + OVERLAP)
    const total = pw + panelW - OVERLAP
    const x0 = (vw - total) / 2
    const portraitX = side === 'left' ? x0 : x0 + panelW - OVERLAP
    const panelX = side === 'left' ? x0 + pw - OVERLAP : x0
    const inner = PANEL_BORDER + OVERLAP + PANEL_INNER_GAP
    const edge = PANEL_BORDER + 16
    const cx = side === 'left' ? panelX + inner : panelX + edge
    const cw = panelW - inner - edge
    return {
      mode: 'row',
      portrait: { x: portraitX, y: baseY - ph, w: pw, h: ph },
      panel: { x: panelX, y: baseY - panelH, w: panelW, h: panelH },
      content: { x: cx, y: baseY - panelH + PANEL_BORDER + 12, w: cw, h: panelH - 2 * (PANEL_BORDER + 12) },
    }
  }
  const panelW = vw
  const portraitX = side === 'left' ? 0 : vw - pw
  const panelY = baseY - panelH
  const top = PANEL_BORDER + OVERLAP + PANEL_INNER_GAP
  return {
    mode: 'column',
    portrait: { x: portraitX, y: panelY - ph + OVERLAP, w: pw, h: ph },
    panel: { x: 0, y: panelY, w: panelW, h: panelH },
    content: { x: 16, y: panelY + top, w: panelW - 32, h: panelH - top - PANEL_BORDER - 12 },
  }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Depth of the portrait box inside the panel's outer box along the stacking axis (0 when apart). */
export function overlapDepth(l: StageLayout): number {
  if (l.mode === 'row') {
    const w = Math.min(l.portrait.x + l.portrait.w, l.panel.x + l.panel.w) - Math.max(l.portrait.x, l.panel.x)
    return Math.max(0, w)
  }
  return Math.max(0, l.portrait.y + l.portrait.h - l.panel.y)
}
