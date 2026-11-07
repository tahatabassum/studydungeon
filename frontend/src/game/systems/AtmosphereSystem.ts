import Phaser from 'phaser'
import { MAX_PARTICLES, type ParticleSpec, type RoomTheme } from '../world/roomTheme'
import { themeBudget } from '../world/themeBudget'
import { TILE, WORLD_H, WORLD_W, type Point } from '../world/RoomLayout'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'

interface Look {
  scale: number
  alpha: number
  dx: number
  dy: number
  minMs: number
  maxMs: number
  add: boolean
}

const LOOKS: Record<ParticleSpec['kind'], Look> = {
  dust: { scale: 0.3, alpha: 0.35, dx: 30, dy: 20, minMs: 6000, maxMs: 10000, add: false },
  bubble: { scale: 0.4, alpha: 0.4, dx: 10, dy: -60, minMs: 4000, maxMs: 7000, add: false },
  ember: { scale: 0.3, alpha: 0.7, dx: 20, dy: -80, minMs: 3000, maxMs: 6000, add: true },
  spark: { scale: 0.25, alpha: 0.8, dx: 25, dy: -40, minMs: 1500, maxMs: 3000, add: true },
  mist: { scale: 1.6, alpha: 0.12, dx: 60, dy: 10, minMs: 9000, maxMs: 14000, add: false },
}

const FOG_COUNT = 3
const DEPTH_FOG = 4
const DEPTH_PARTICLE = 11

/**
 * Ambient particles and light fog for the current room. Uses pre-created pooled images;
 * tweens loop, so nothing is allocated per frame. Under reduced motion nothing moves.
 */
export class AtmosphereSystem {
  private readonly pool: ObjectPool<Phaser.GameObjects.Image>
  private readonly fog: Phaser.GameObjects.Ellipse[] = []
  private readonly active: Phaser.GameObjects.Image[] = []

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    ensureSparkTexture(scene)
    this.pool = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark').setDepth(DEPTH_PARTICLE).setVisible(false),
      reset: (img) => img.setVisible(true).setActive(true),
      max: MAX_PARTICLES,
    })
    for (let i = 0; i < FOG_COUNT; i++) {
      this.fog.push(scene.add.ellipse(0, 0, 420, 200, 0xffffff, 0.05).setDepth(DEPTH_FOG).setVisible(false))
    }
  }

  /** Number of particles currently shown (never above MAX_PARTICLES). */
  get activeCount(): number {
    return this.active.length
  }

  /** Show the ambience for a room (origin = top-left of the room rect). */
  setRoom(theme: RoomTheme, origin: Point): void {
    this.clearRoom()
    const reduced = this.isReduced()
    const spec = theme.particles
    const look = LOOKS[spec.kind]
    const n = themeBudget(theme, reduced).ambient
    const minX = origin.x + TILE * 2
    const minY = origin.y + TILE * 2
    const spanX = WORLD_W - TILE * 4
    const spanY = WORLD_H - TILE * 4

    for (let i = 0; i < n; i++) {
      const img = this.pool.acquire()
      if (!img) break
      const x = minX + Math.random() * spanX
      const y = minY + Math.random() * spanY
      img
        .setPosition(x, y)
        .setTint(spec.color)
        .setScale(look.scale)
        .setAlpha(look.alpha)
        .setBlendMode(look.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      this.active.push(img)
      if (reduced) continue
      this.scene.tweens.add({
        targets: img,
        x: x + (Math.random() * 2 - 1) * look.dx,
        y: y + look.dy * (0.5 + Math.random() * 0.5),
        alpha: { from: look.alpha * 0.3, to: look.alpha },
        duration: look.minMs + Math.random() * (look.maxMs - look.minMs),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    if (!reduced && (theme.id === 'pumpkin_workshop' || theme.id === 'boss_hall' || theme.id === 'clockwork_crypt')) {
      this.fog.forEach((f, i) => {
        const x = origin.x + (WORLD_W * (i + 1)) / (FOG_COUNT + 1)
        const y = origin.y + WORLD_H * (0.35 + 0.15 * (i % 2))
        f.setPosition(x, y).setFillStyle(spec.color, 0.06).setVisible(true)
        this.scene.tweens.add({
          targets: f,
          x: x + 70 * (i % 2 ? -1 : 1),
          duration: 9000 + i * 2500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      })
    }
  }

  /** Hide everything and stop its tweens. */
  clearRoom(): void {
    for (const img of this.active) {
      this.scene.tweens.killTweensOf(img)
      img.setVisible(false)
    }
    this.active.length = 0
    this.pool.releaseAll()
    for (const f of this.fog) {
      this.scene.tweens.killTweensOf(f)
      f.setVisible(false)
    }
  }

  destroy(): void {
    this.clearRoom()
    this.pool.clear((img) => img.destroy())
    for (const f of this.fog) f.destroy()
    this.fog.length = 0
  }
}
