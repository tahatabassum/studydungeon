import { drawGhost } from './ghost'
import { drawGolem } from './golem'
import { drawSkeleton } from './skeleton'
import { drawVampire } from './vampire'
import { drawWarden } from './warden'
import { drawWitch } from './witch'
import { PORTRAIT_H, PORTRAIT_KINDS, PORTRAIT_W, POSES, portraitFor, type PortraitDrawer, type PortraitKind, type Pose } from './types'

export { PORTRAIT_H, PORTRAIT_KINDS, PORTRAIT_W, POSES, portraitFor }
export type { PortraitDrawer, PortraitKind, Pose }

/** Registry of every character drawer. */
export const PORTRAITS: Readonly<Record<PortraitKind, PortraitDrawer>> = {
  ghost: drawGhost,
  vampire: drawVampire,
  skeleton: drawSkeleton,
  golem: drawGolem,
  witch: drawWitch,
  warden: drawWarden,
}

const cache = new Map<string, HTMLCanvasElement>()

/**
 * One cached bitmap per character and pose. Returns null when no 2D canvas is available
 * (for example in a test DOM without canvas support).
 */
export function portraitBitmap(kind: PortraitKind, pose: Pose): HTMLCanvasElement | null {
  const key = `${kind}:${pose}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = PORTRAIT_W
  canvas.height = PORTRAIT_H
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return null
  PORTRAITS[kind](ctx, pose)
  cache.set(key, canvas)
  return canvas
}
