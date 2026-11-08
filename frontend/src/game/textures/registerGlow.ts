import type Phaser from 'phaser'
import { rgba } from '@/art/room/color'
import type { GlowKey } from '../world/roomTheme'

export const GLOW_SIZE = 128

export const GLOW_COLORS: Readonly<Record<GlowKey, number>> = {
  warm: 0xf28a1e,
  cool: 0x68c9a5,
  green: 0x8be04e,
  purple: 0x9b5de5,
  red: 0xb83d4a,
}

export const glowKey = (k: GlowKey): string => `glow_${k}`

export const VIGNETTE_KEY = 'vignette'
export const SHADOW_KEY = 'shadow_soft'
export const BEAM_KEY = 'beam'
export const FOG_BLOB_KEY = 'fog_blob'

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function make(scene: Phaser.Scene, key: string, w: number, h: number, paint: Painter): void {
  if (scene.textures.exists(key)) return
  const tex = scene.textures.createCanvas(key, w, h)
  if (!tex) return
  const ctx = tex.getContext()
  paint(ctx, w, h)
  tex.refresh()
}

function radial(color: number, peak: number): Painter {
  return (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, rgba(color, peak))
    g.addColorStop(0.45, rgba(color, peak * 0.4))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

/**
 * Registers baked canvas textures for lighting: five radial glows (used with ADD blending),
 * a screen-edge vignette, soft contact shadow, light beam and fog blob. Works in WebGL and Canvas.
 * Safe to call more than once.
 */
export function registerGlow(scene: Phaser.Scene): void {
  for (const k of Object.keys(GLOW_COLORS) as GlowKey[]) {
    make(scene, glowKey(k), GLOW_SIZE, GLOW_SIZE, radial(GLOW_COLORS[k], 1))
  }

  // Black edges, clear center (scaled 2x over the 960x540 view).
  make(scene, VIGNETTE_KEY, 480, 270, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })

  make(scene, SHADOW_KEY, 64, 32, (ctx, w, h) => {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(1, h / w)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.9)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(-w / 2, -w / 2, w, w)
    ctx.restore()
  })

  make(scene, BEAM_KEY, 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(200,220,255,0.5)')
    g.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(w * 0.3, 0)
    ctx.lineTo(w * 0.7, 0)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
  })

  make(scene, FOG_BLOB_KEY, 256, 128, (ctx, w, h) => {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.scale(1, h / w)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(-w / 2, -w / 2, w, w)
    ctx.restore()
  })
}
