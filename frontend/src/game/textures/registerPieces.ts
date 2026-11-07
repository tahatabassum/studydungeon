import type Phaser from 'phaser'

export const PIECE_TEXTURES = {
  hourHand: 'piece_hour_hand',
  minuteHand: 'piece_minute_hand',
  pendulum: 'piece_pendulum',
  gearLarge: 'piece_gear_l',
  gearSmall: 'piece_gear_s',
  steam: 'piece_steam',
  batRoost: 'piece_bat_roost',
  batUp: 'piece_bat_up',
  batDown: 'piece_bat_down',
} as const

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function make(scene: Phaser.Scene, key: string, w: number, h: number, paint: Painter): void {
  if (scene.textures.exists(key)) return
  const tex = scene.textures.createCanvas(key, w, h)
  if (!tex) return
  paint(tex.getContext(), w, h)
  tex.refresh()
}

function hand(color: string, width: number): Painter {
  return (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2 + width / 2, h * 0.85)
    ctx.lineTo(w / 2 - width / 2, h * 0.85)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(w / 2 - 1, h * 0.85, 2, h * 0.15)
  }
}

function gear(teeth: number, outer: number, inner: number, hole: number): Painter {
  return (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    ctx.fillStyle = '#6a5a48'
    ctx.beginPath()
    const steps = teeth * 4
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps
      const r = i % 4 < 2 ? outer : inner
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath()
    ctx.arc(cx, cy, inner * 0.8, Math.PI, Math.PI * 1.7)
    ctx.lineTo(cx, cy)
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, hole, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * inner * 0.55, cy + Math.sin(a) * inner * 0.55, inner * 0.18, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

function bat(wings: 'up' | 'down' | 'folded'): Painter {
  return (ctx, w, h) => {
    ctx.fillStyle = '#0e0a14'
    const cx = w / 2
    ctx.beginPath()
    ctx.ellipse(cx, h / 2, 2.5, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(cx - 3, h / 2 - 5, 2, 2)
    ctx.fillRect(cx + 1, h / 2 - 5, 2, 2)
    if (wings === 'folded') {
      ctx.fillRect(cx - 4, h / 2 - 1, 8, 5)
      return
    }
    const y = wings === 'up' ? 0 : h - 3
    ctx.beginPath()
    ctx.moveTo(cx - 2, h / 2)
    ctx.lineTo(0, y)
    ctx.lineTo(3, h / 2 + 1)
    ctx.lineTo(cx, h / 2 + 2)
    ctx.lineTo(w - 3, h / 2 + 1)
    ctx.lineTo(w, y)
    ctx.lineTo(cx + 2, h / 2)
    ctx.closePath()
    ctx.fill()
  }
}

/** Registers the small canvas textures used by AnimatedPieces. Safe to call more than once. */
export function registerPieces(scene: Phaser.Scene): void {
  make(scene, PIECE_TEXTURES.minuteHand, 6, 52, hand('#2a1e1a', 6))
  make(scene, PIECE_TEXTURES.hourHand, 8, 34, hand('#2a1e1a', 8))
  make(scene, PIECE_TEXTURES.pendulum, 16, 84, (ctx, w) => {
    ctx.fillStyle = '#8a6a3a'
    ctx.fillRect(w / 2 - 1, 0, 2, 66)
    ctx.beginPath()
    ctx.arc(w / 2, 74, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#b8914a'
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(w / 2 - 4, 70, 3, 3)
  })
  make(scene, PIECE_TEXTURES.gearLarge, 100, 100, gear(12, 48, 40, 8))
  make(scene, PIECE_TEXTURES.gearSmall, 60, 60, gear(8, 28, 23, 5))
  make(scene, PIECE_TEXTURES.steam, 16, 16, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(235,235,245,0.7)')
    g.addColorStop(1, 'rgba(235,235,245,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  make(scene, PIECE_TEXTURES.batRoost, 12, 12, bat('folded'))
  make(scene, PIECE_TEXTURES.batUp, 20, 12, bat('up'))
  make(scene, PIECE_TEXTURES.batDown, 20, 12, bat('down'))
}
