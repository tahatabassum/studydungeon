import { getSprite } from '@/art/sprites'
import { TILE, WORLD_H, WORLD_W, type Point, type Rect } from './RoomLayout'
import type { DecorSpec, RoomTheme } from './roomTheme'

/** Decor textures are rendered at this integer scale (see registerArt). */
export const DECOR_SCALE = 2

export interface Placement {
  sprite: string
  /** Center in world coordinates. */
  x: number
  y: number
  /** Displayed size in px. */
  w: number
  h: number
}

/** Size in px of a decor sprite as displayed; 0 when unknown. */
function displaySize(name: string): { w: number; h: number } {
  const s = getSprite(name)
  return s ? { w: s.width * DECOR_SCALE, h: s.height * DECOR_SCALE } : { w: 0, h: 0 }
}

/** Position of one decor spec within a room whose top-left is `origin`. Pure. */
export function placeDecor(spec: DecorSpec, origin: Point): Placement {
  const { w, h } = displaySize(spec.sprite)
  const slot = spec.slot
  const gap = 2
  let x = origin.x
  let y = origin.y
  switch (slot.at) {
    case 'north':
      x += slot.offset
      y += TILE + h / 2 + gap
      break
    case 'south':
      x += slot.offset
      y += WORLD_H - TILE - h / 2 - gap
      break
    case 'west':
      x += TILE + w / 2 + gap
      y += slot.offset
      break
    case 'east':
      x += WORLD_W - TILE - w / 2 - gap
      y += slot.offset
      break
    case 'corner-nw':
      x += TILE + w / 2
      y += TILE + h / 2
      break
    case 'corner-ne':
      x += WORLD_W - TILE - w / 2
      y += TILE + h / 2
      break
    case 'floor':
      x += slot.x
      y += slot.y
      break
  }
  return { sprite: spec.sprite, x, y, w, h }
}

/** All placements for a theme; deterministic from the room origin. */
export function placementsFor(theme: RoomTheme, origin: Point): Placement[] {
  return theme.decor.map((d) => placeDecor(d, origin))
}

/** True when the placement's bounds overlap the rect. */
export function overlapsRect(p: Placement, r: Rect): boolean {
  return (
    p.x - p.w / 2 < r.x + r.w &&
    p.x + p.w / 2 > r.x &&
    p.y - p.h / 2 < r.y + r.h &&
    p.y + p.h / 2 > r.y
  )
}
