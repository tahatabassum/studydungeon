import { useEffect, useRef } from 'react'
import { PORTRAIT_H, PORTRAIT_W, portraitBitmap, portraitFor, type Pose } from './index'

export interface PortraitCanvasProps {
  /** Backend monster kind; unknown kinds draw the Skeleton. */
  kind: string
  pose: Pose
  className?: string
}

/**
 * Draws the cached bitmap for (character, pose). The bob (idle, talking) and shake (hurt) are CSS
 * animations in encounter.css, switched off under Reduced_Motion. Decorative: hidden from assistive tech.
 */
export function PortraitCanvas({ kind, pose, className }: PortraitCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const character = portraitFor(kind)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const bitmap = portraitBitmap(character, pose)
    const ctx = canvas.getContext('2d')
    if (!bitmap || !ctx) return
    ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H)
    ctx.drawImage(bitmap, 0, 0)
  }, [character, pose])

  return (
    <canvas
      ref={ref}
      width={PORTRAIT_W}
      height={PORTRAIT_H}
      aria-hidden="true"
      data-character={character}
      data-pose={pose}
      className={`sd-portrait sd-portrait--${pose} ${className ?? ''}`}
    />
  )
}
