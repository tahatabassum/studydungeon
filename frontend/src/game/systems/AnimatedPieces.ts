import Phaser from 'phaser'
import { PIECE_TEXTURES } from '../textures/registerPieces'
import type { PieceSpec, RoomTheme } from '../world/roomTheme'
import { PIECE_CAP } from '../world/themeBudget'
import type { Point } from '../world/RoomLayout'
import { batOffset, clockAngles, gearRad, pendulumDeg, type ClockAngles } from './pieceMotion'
import { ObjectPool } from './objectPool'

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
    scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    this.images = new ObjectPool({
      create: () => scene.add.image(0, 0, PIECE_TEXTURES.steam).setDepth(DEPTH_PIECE).setVisible(false),
      reset: (img) =>
        img.setVisible(true).setActive(true).setAlpha(1).setScale(1).setAngle(0).setOrigin(0.5, 0.5).clearTint(),
      max: PIECE_CAP,
    })
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
        default:
          break
      }
    }
    this.active = true
    this.nextPuff = 0
    this.nextBat = 0
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
    if (reduced) {
      for (const p of this.puffs) p.img.setVisible(false)
      for (const b of this.bats) b.img.setTexture(PIECE_TEXTURES.batRoost).setPosition(b.x, b.y)
      return
    }
    this.updateSteam(time)
    this.updateBats(time)
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
    this.vents = []
    this.hour = this.minute = this.pendulum = this.gearL = this.gearS = null
  }

  destroy(): void {
    this.clearRoom()
    this.images.clear((img) => img.destroy())
  }
}
