import Phaser from 'phaser'
import { glowKey } from '../textures/registerGlow'
import { PIECE_TEXTURES } from '../textures/registerPieces'
import type { PieceSpec, RoomTheme } from '../world/roomTheme'
import { PIECE_CAP } from '../world/themeBudget'
import type { Point } from '../world/RoomLayout'
import { flicker } from './flicker'
import {
  batOffset,
  bobY,
  clockAngles,
  gearRad,
  ghostAlpha,
  lightningAlpha,
  loopU,
  pageDrift,
  pendulumDeg,
  type ClockAngles,
} from './pieceMotion'
import { ObjectPool } from './objectPool'
import { nextLightningAt } from '../lightning'
import type { Rect } from '../viewport'

const DEPTH_PIECE = 9
const STEAM_LIFE_MS = 1200
const STEAM_RISE = 40
const BAT_FLIGHT_MS = 3200
const BAT_FLAP_MS = 120
const VENT_SPACING = 160

interface Puff {
  img: Phaser.GameObjects.Image
  born: number
  x: number
  y: number
}
interface Bat {
  img: Phaser.GameObjects.Image
  x: number
  y: number
  start: number
  flying: boolean
}
type FloatKind = 'candle' | 'page' | 'book' | 'bubble' | 'jar' | 'flame'
/** A pooled piece driven by pure motion math (floating candles, pages, books, bubbles, jars, flames). */
interface Floater {
  img: Phaser.GameObjects.Image
  kind: FloatKind
  x: number
  y: number
  phase: number
  seed: number
}

const DEPTH_LIGHTNING = 90
const LIGHTNING_RAND_MS = 12000
const ENRAGED_RAND_MS = 3000
const BUBBLE_RISE = 50

/**
 * Animated, pooled pieces for a room (clock hands, pendulum, gears, steam, bats). Motion is driven
 * from one update loop using pure math from pieceMotion; nothing is allocated per frame.
 * Reduced motion holds a fixed pose, shows no steam and keeps bats roosted.
 */
export class AnimatedPieces {
  private readonly images: ObjectPool<Phaser.GameObjects.Image>
  private readonly angles: ClockAngles = { hour: 0, minute: 0 }
  private readonly flight = { x: 0, y: 0 }
  private readonly puffs: Puff[] = []
  private readonly bats: Bat[] = []
  private readonly floaters: Floater[] = []
  private readonly drift = { x: 0, y: 0, rot: 0 }
  private overlay: Phaser.GameObjects.Rectangle | null = null
  private screenRect: Rect = { x: 0, y: 0, w: 960, h: 540 }
  private nextStrike = 0
  private strikeAt = -1e9
  private jars = 0
  /** The room theme carries lightning (the boss hall). */
  private themeLightning = false
  /** Enraged boss: lightning runs even if the theme has none, and flashes come sooner (still 8 s apart). */
  private enraged = false
  private lightning = false
  private hour: Phaser.GameObjects.Image | null = null
  private minute: Phaser.GameObjects.Image | null = null
  private pendulum: Phaser.GameObjects.Image | null = null
  private gearL: Phaser.GameObjects.Image | null = null
  private gearS: Phaser.GameObjects.Image | null = null
  private vents: Point[] = []
  private nextPuff = 0
  private nextBat = 0
  private active = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    this.images = new ObjectPool({
      create: () => scene.add.image(0, 0, PIECE_TEXTURES.steam).setDepth(DEPTH_PIECE).setVisible(false),
      reset: (img) =>
        img
          .setVisible(true)
          .setActive(true)
          .setAlpha(1)
          .setScale(1)
          .setAngle(0)
          .setOrigin(0.5, 0.5)
          .setBlendMode(Phaser.BlendModes.NORMAL)
          .clearTint(),
      max: PIECE_CAP,
    })
  }

  private addFloater(kind: FloatKind, img: Phaser.GameObjects.Image | null, x: number, y: number, phase: number): void {
    if (!img) return
    this.floaters.push({ img, kind, x, y, phase, seed: 60 + this.floaters.length })
  }

  /** Lightning overlay for the boss hall: created once, hidden until a strike. */
  private ensureOverlay(): void {
    if (this.overlay) return
    const r = this.screenRect
    this.overlay = this.scene.add
      .rectangle(r.x, r.y, r.w, r.h, 0xcfe0ff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_LIGHTNING)
      .setVisible(false)
  }

  /** Re-fit the screen-space lightning overlay to the viewport (called on resize). */
  setScreenRect(r: Rect): void {
    this.screenRect = r
    this.overlay?.setPosition(r.x, r.y).setSize(r.w, r.h)
  }

  /** Number of piece objects currently in use. */
  get activeCount(): number {
    return this.images.activeCount
  }

  private take(texture: string, x: number, y: number): Phaser.GameObjects.Image | null {
    const img = this.images.acquire()
    if (!img) return null
    return img.setTexture(texture).setPosition(x, y)
  }

  /** Build the pieces listed in the theme at the room origin. */
  setRoom(theme: RoomTheme, origin: Point): void {
    this.clearRoom()
    const T = PIECE_TEXTURES
    for (const spec of theme.pieces) {
      const x = origin.x + spec.x
      const y = origin.y + spec.y
      switch (spec.kind) {
        case 'clockHands':
          this.hour = this.take(T.hourHand, x, y)?.setOrigin(0.5, 0.88) ?? null
          this.minute = this.take(T.minuteHand, x, y)?.setOrigin(0.5, 0.92) ?? null
          break
        case 'pendulum':
          this.pendulum = this.take(T.pendulum, x, y)?.setOrigin(0.5, 0) ?? null
          break
        case 'gear':
          this.gearL = this.take(T.gearLarge, x, y) ?? null
          this.gearS = this.take(T.gearSmall, x - 62, y + 26) ?? null
          break
        case 'steam':
          this.vents = [
            { x, y },
            { x: x + VENT_SPACING, y },
          ]
          this.buildSteam(spec)
          break
        case 'bat':
          this.buildBats(spec, origin)
          break
        case 'candle':
          this.addFloater('candle', this.take(T.candle, x, y), x, y, this.floaters.length * 0.37)
          break
        case 'page':
          this.addFloater('page', this.take(T.page, x, y), x, y, 0.15 + this.floaters.length * 0.29)
          break
        case 'book':
          this.addFloater(
            'book',
            this.take(T.book, x, y)?.setTint(0x68c9a5).setAlpha(0.55) ?? null,
            x,
            y,
            this.floaters.length * 0.41,
          )
          break
        case 'bubble':
          for (let i = 0; i < spec.count; i++) {
            const bx = x + ((i % 3) - 1) * 12
            this.addFloater('bubble', this.take(T.bubble, bx, y), bx, y, i / spec.count)
          }
          break
        case 'jar': {
          const eye = this.jars++ % 2 === 0
          const img = this.take(eye ? T.jarEye : T.jarSpark, x, y)
          if (!eye) img?.setBlendMode(Phaser.BlendModes.ADD)
          this.addFloater('jar', img, x, y, this.floaters.length * 0.5)
          break
        }
        case 'flame': {
          const img = this.take(glowKey(spec.glow ?? 'warm'), x, y)?.setBlendMode(Phaser.BlendModes.ADD)
          img?.setDisplaySize(40, 40)
          this.addFloater('flame', img ?? null, x, y, 0)
          break
        }
        case 'lightning':
          this.ensureOverlay()
          this.themeLightning = true
          this.lightning = true
          break
        default:
          break
      }
    }
    this.active = true
    this.nextPuff = 0
    this.nextBat = 0
    this.nextStrike = 0
    this.strikeAt = -1e9
    this.pose(0, this.isReduced())
  }

  private buildSteam(spec: PieceSpec): void {
    for (let i = 0; i < spec.count; i++) {
      const img = this.take(PIECE_TEXTURES.steam, 0, 0)
      if (!img) break
      img.setVisible(false)
      this.puffs.push({ img, born: -1, x: 0, y: 0 })
    }
  }

  private buildBats(spec: PieceSpec, origin: Point): void {
    // Three roost points under the north wall (design: x 496, 520, 832).
    const roosts = [496, 520, 832]
    for (let i = 0; i < spec.count; i++) {
      const rx = origin.x + (roosts[i] ?? spec.x + i * 24)
      const ry = origin.y + spec.y + (i === 1 ? 4 : i === 2 ? 2 : 0)
      const img = this.take(PIECE_TEXTURES.batRoost, rx, ry)
      if (!img) break
      this.bats.push({ img, x: rx, y: ry, start: 0, flying: false })
    }
  }

  /** Fixed or time-driven pose for the rotating pieces. */
  private pose(time: number, reduced: boolean): void {
    if (this.minute && this.hour) {
      clockAngles(time, reduced, this.angles)
      this.minute.setRotation(this.angles.minute)
      this.hour.setRotation(this.angles.hour)
    }
    this.pendulum?.setAngle(pendulumDeg(time, reduced))
    this.gearL?.setRotation(gearRad(time, reduced, true))
    this.gearS?.setRotation(gearRad(time, reduced, false))
  }

  update(time: number): void {
    if (!this.active) return
    const reduced = this.isReduced()
    this.pose(time, reduced)
    this.updateFloaters(time, reduced)
    if (reduced) {
      for (const p of this.puffs) p.img.setVisible(false)
      for (const b of this.bats) b.img.setTexture(PIECE_TEXTURES.batRoost).setPosition(b.x, b.y)
      this.overlay?.setVisible(false)
      return
    }
    this.updateSteam(time)
    this.updateBats(time)
    this.updateLightning(time)
  }

  /**
   * Enraged boss phase: the same overlay flashes more often (8 to 11 s apart instead of 8 to 20 s).
   * Spacing and peak alpha stay as before; update() never reaches the lightning under reduced motion.
   */
  setEnraged(on: boolean): void {
    if (this.enraged === on) return
    this.enraged = on
    if (on) this.ensureOverlay()
    this.lightning = this.themeLightning || (on && this.active)
    this.nextStrike = 0
    if (!this.lightning) this.overlay?.setVisible(false)
  }

  /** Soft lightning flash at most once per 8 s (peak alpha 0.25). Never runs under reduced motion. */
  private updateLightning(time: number): void {
    const o = this.overlay
    if (!o || !this.lightning) return
    const rand = this.enraged ? ENRAGED_RAND_MS : LIGHTNING_RAND_MS
    if (this.nextStrike === 0) {
      // Enraged: the first flash follows the roar closely, but never within 8 s of the last one.
      this.nextStrike = this.enraged
        ? nextLightningAt(time, this.strikeAt, false, 400 + Math.random() * 600)
        : nextLightningAt(time, time, false, Math.random() * rand)
    }
    if (time >= this.nextStrike) {
      this.strikeAt = time
      this.nextStrike = nextLightningAt(time, time, false, Math.random() * rand)
    }
    const a = lightningAlpha(time - this.strikeAt)
    o.setAlpha(a).setVisible(a > 0)
  }

  private updateFloaters(time: number, reduced: boolean): void {
    for (const f of this.floaters) {
      const img = f.img
      switch (f.kind) {
        case 'candle':
          img.setPosition(f.x, f.y + bobY(time, f.phase, reduced))
          break
        case 'book':
          img.setPosition(f.x, f.y + bobY(time, f.phase, reduced)).setAlpha(ghostAlpha(time, f.phase, reduced))
          break
        case 'jar':
          img.setPosition(f.x, f.y + bobY(time, f.phase, reduced) * 0.5).setAlpha(0.7 + 0.3 * flicker(time, f.seed, 0, 1, reduced))
          break
        case 'page': {
          const u = loopU(time, 9000, f.phase, reduced)
          pageDrift(u, this.drift)
          img
            .setPosition(f.x + this.drift.x, f.y + this.drift.y)
            .setRotation(this.drift.rot)
            .setAlpha(0.85 * Math.sin(Math.PI * u))
          break
        }
        case 'bubble': {
          const u = loopU(time, 1800, f.phase, reduced)
          img.setPosition(f.x + Math.sin(u * 6) * 2, f.y - BUBBLE_RISE * u).setAlpha(0.9 * (1 - u)).setScale(0.7 + 0.5 * u)
          break
        }
        case 'flame':
          img.setAlpha(flicker(time, f.seed, 0.45, 0.95, reduced))
          break
      }
    }
  }

  private updateSteam(time: number): void {
    if (this.vents.length === 0) return
    if (time >= this.nextPuff) {
      this.nextPuff = time + 2000 + Math.random() * 2000
      for (const p of this.puffs) {
        if (p.born >= 0) continue
        const v = this.vents[Math.floor(Math.random() * this.vents.length)]
        p.born = time
        p.x = v.x
        p.y = v.y
        p.img.setVisible(true)
        break
      }
    }
    for (const p of this.puffs) {
      if (p.born < 0) continue
      const u = (time - p.born) / STEAM_LIFE_MS
      if (u >= 1) {
        p.born = -1
        p.img.setVisible(false)
        continue
      }
      p.img.setPosition(p.x + Math.sin(u * 6) * 3, p.y - STEAM_RISE * u).setAlpha((1 - u) * 0.8).setScale(0.8 + u * 1.4)
    }
  }

  private updateBats(time: number): void {
    if (this.bats.length === 0) return
    if (this.nextBat === 0) this.nextBat = time + 8000 + Math.random() * 12000
    if (time >= this.nextBat) {
      this.nextBat = time + 8000 + Math.random() * 12000
      const b = this.bats[Math.floor(Math.random() * this.bats.length)]
      if (!b.flying) {
        b.flying = true
        b.start = time
      }
    }
    for (const b of this.bats) {
      if (!b.flying) continue
      const u = (time - b.start) / BAT_FLIGHT_MS
      if (u >= 1) {
        b.flying = false
        b.img.setTexture(PIECE_TEXTURES.batRoost).setPosition(b.x, b.y)
        continue
      }
      batOffset(u, this.flight)
      const flap = Math.floor((time - b.start) / BAT_FLAP_MS) % 2 === 0
      b.img
        .setTexture(flap ? PIECE_TEXTURES.batUp : PIECE_TEXTURES.batDown)
        .setPosition(b.x + this.flight.x, b.y + this.flight.y)
    }
  }

  clearRoom(): void {
    this.active = false
    for (const img of this.images.active()) img.setVisible(false)
    this.images.releaseAll()
    this.puffs.length = 0
    this.bats.length = 0
    this.floaters.length = 0
    this.jars = 0
    this.lightning = false
    this.themeLightning = false
    this.enraged = false
    this.overlay?.setVisible(false)
    this.vents = []
    this.hour = this.minute = this.pendulum = this.gearL = this.gearS = null
  }

  destroy(): void {
    this.clearRoom()
    this.images.clear((img) => img.destroy())
    this.overlay?.destroy()
    this.overlay = null
  }
}
