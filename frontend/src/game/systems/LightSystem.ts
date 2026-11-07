import Phaser from 'phaser'
import { COLORS } from '../colors'
import { GLOW_SIZE, SHADOW_KEY, VIGNETTE_KEY, glowKey } from '../textures/registerGlow'
import type { GlowKey, LightSpec, RoomTheme } from '../world/roomTheme'
import { WORLD_H, WORLD_W, type Point } from '../world/RoomLayout'
import { flicker } from './flicker'

/** Most additive light pools shown at once: 12 on WebGL, 6 on the Canvas renderer. */
export const MAX_LIGHTS_WEBGL = 12
export const MAX_LIGHTS_CANVAS = 6

const TORCH_RADIUS = 112
const DEPTH_TINT = 4
const DEPTH_LIGHT = 5
const DEPTH_SHADOW = 6
const DEPTH_AURA = 20
const DEPTH_VIGNETTE = 100
const VIGNETTE_ALPHA = 0.55
const INDIGO_ALPHA = 0.12
/** Light pool peak alpha before flicker. */
const POOL_PEAK = 0.6

/** Anything with a world position and alive flag (the Monster entity). */
export interface LightTarget {
  readonly position: Point
  readonly alive: boolean
  /** World y of the feet (for the glow ring and shadow). */
  readonly footY: number
}

interface Entry {
  img: Phaser.GameObjects.Image
  x: number
  y: number
  baseScale: number
  min: number
  max: number
  seed: number
  on: boolean
}

/**
 * Baked-glow lighting: flickering ADD light pools, an indigo MULTIPLY tint, a screen vignette,
 * a glow ring under the active monster, a faint player aura and soft contact shadows.
 * All images are created up front; update() only writes alpha/scale/position (no allocation).
 */
export class LightSystem {
  private readonly entries: Entry[] = []
  private readonly tint: Phaser.GameObjects.Rectangle
  private readonly vignette: Phaser.GameObjects.Image
  private readonly ring: Phaser.GameObjects.Image
  private readonly aura: Phaser.GameObjects.Image
  private readonly playerShadow: Phaser.GameObjects.Image
  private readonly monsterShadow: Phaser.GameObjects.Image
  private readonly maxLights: number
  private player: { x: number; y: number } | null = null
  private monster: LightTarget | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    const canvas = scene.game.renderer.type === Phaser.CANVAS
    this.maxLights = canvas ? MAX_LIGHTS_CANVAS : MAX_LIGHTS_WEBGL
    for (let i = 0; i < this.maxLights; i++) {
      const img = scene.add
        .image(0, 0, glowKey('warm'))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH_LIGHT)
        .setVisible(false)
      this.entries.push({ img, x: 0, y: 0, baseScale: 1, min: 0, max: 1, seed: 0, on: false })
    }
    this.tint = scene.add
      .rectangle(0, 0, WORLD_W, WORLD_H, COLORS.INDIGO, INDIGO_ALPHA)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH_TINT)
      .setVisible(false)
    this.ring = scene.add
      .image(0, 0, glowKey('warm'))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(128, 48)
      .setDepth(DEPTH_SHADOW)
      .setVisible(false)
    this.aura = scene.add
      .image(0, 0, glowKey('purple'))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(80, 80)
      .setAlpha(0.12)
      .setDepth(DEPTH_AURA)
    this.playerShadow = this.makeShadow()
    this.monsterShadow = this.makeShadow().setVisible(false)
    this.vignette = scene.add
      .image(0, 0, VIGNETTE_KEY)
      .setOrigin(0, 0)
      .setScale(2)
      .setScrollFactor(0)
      .setAlpha(VIGNETTE_ALPHA)
      .setDepth(DEPTH_VIGNETTE)
  }

  private makeShadow(): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, SHADOW_KEY)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(0.5)
      .setDepth(DEPTH_SHADOW)
  }

  /** Number of light pools currently shown. */
  get activeCount(): number {
    let n = 0
    for (const e of this.entries) if (e.on) n++
    return n
  }

  follow(player: { x: number; y: number } | null): void {
    this.player = player
  }

  setMonster(monster: LightTarget | null): void {
    this.monster = monster
  }

  /**
   * Show the lights for a room. `torches` are world positions; theme lights and `extra`
   * (e.g. candle pools) are room-local and translated by `origin`. Torches take priority
   * when the light budget is tight.
   */
  setRoom(theme: RoomTheme, origin: Point, torches: readonly Point[], extra: readonly LightSpec[] = []): void {
    const specs: Array<{ x: number; y: number; radius: number; glow: GlowKey; min: number; max: number; seed: number }> = []
    torches.forEach((t, i) =>
      specs.push({ x: t.x, y: t.y, radius: TORCH_RADIUS, glow: 'warm', min: 0.55, max: 1, seed: 1 + i }),
    )
    for (const l of [...theme.lights, ...extra]) specs.push({ ...l, x: l.x + origin.x, y: l.y + origin.y })
    this.entries.forEach((e, i) => {
      const s = specs[i]
      if (!s) {
        e.on = false
        e.img.setVisible(false)
        return
      }
      e.on = true
      e.x = s.x
      e.y = s.y
      e.min = s.min
      e.max = s.max
      e.seed = s.seed
      e.baseScale = (s.radius * 2) / GLOW_SIZE
      e.img.setTexture(glowKey(s.glow)).setPosition(s.x, s.y).setScale(e.baseScale).setVisible(true)
    })
    this.tint.setPosition(origin.x, origin.y).setVisible(true)
  }

  clearRoom(): void {
    for (const e of this.entries) {
      e.on = false
      e.img.setVisible(false)
    }
    this.tint.setVisible(false)
    this.ring.setVisible(false)
    this.monsterShadow.setVisible(false)
    this.monster = null
  }

  update(time: number): void {
    const reduced = this.isReduced()
    for (const e of this.entries) {
      if (!e.on) continue
      const f = flicker(time, e.seed, e.min, e.max, reduced)
      e.img.setAlpha(f * POOL_PEAK).setScale(e.baseScale * (0.94 + 0.12 * f))
    }
    const p = this.player
    if (p) {
      this.aura.setPosition(p.x, p.y)
      this.playerShadow.setPosition(p.x, p.y + 20).setDisplaySize(32, 12)
    }
    const m = this.monster
    if (m && m.alive) {
      const pulse = reduced ? 0.45 : 0.45 + 0.1 * Math.sin((time / 1600) * Math.PI * 2)
      this.ring.setPosition(m.position.x, m.footY).setAlpha(pulse).setVisible(true)
      this.monsterShadow.setPosition(m.position.x, m.footY).setDisplaySize(48, 14).setVisible(true)
    } else {
      this.ring.setVisible(false)
      this.monsterShadow.setVisible(false)
    }
  }

  destroy(): void {
    for (const e of this.entries) e.img.destroy()
    this.entries.length = 0
    this.tint.destroy()
    this.vignette.destroy()
    this.ring.destroy()
    this.aura.destroy()
    this.playerShadow.destroy()
    this.monsterShadow.destroy()
  }
}
