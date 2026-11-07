import Phaser from 'phaser'
import type { Point } from '../world/RoomLayout'

const BAR_W = 64
const BAR_H = 8
const HP_TWEEN_MS = 300

/** Procedural monster built from Room.monster data. Visual bob never moves the collision zone. */
export class Monster {
  readonly id: string
  readonly name: string
  readonly maxHp: number
  /** Static collision body (does not bob) so the player collides with the monster. */
  readonly zone: Phaser.GameObjects.Zone
  readonly position: Point
  alive = true

  private hp: number
  private shownHp: number
  private readonly sprite: Phaser.GameObjects.Image
  private readonly aura: Phaser.GameObjects.Ellipse
  private readonly label: Phaser.GameObjects.Text
  private readonly bar: Phaser.GameObjects.Graphics
  private hpTween: Phaser.Tweens.Tween | null = null
  private readonly parts: Phaser.GameObjects.GameObject[]

  constructor(
    private readonly scene: Phaser.Scene,
    data: { id: string; name: string; max_hp: number },
    at: Point,
    private readonly reducedMotion: boolean,
  ) {
    this.id = data.id
    this.name = data.name
    this.maxHp = data.max_hp
    this.hp = data.max_hp
    this.shownHp = data.max_hp
    this.position = { ...at }

    this.aura = scene.add
      .ellipse(at.x, at.y + 4, 64, 64, 0x7546a8, 0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(7)
    this.sprite = scene.add.image(at.x, at.y, 'monster').setDepth(8)
    this.label = scene.add
      .text(at.x, at.y - 56, data.name, {
        fontFamily: 'serif',
        fontSize: '14px',
        color: '#F2E8D5',
      })
      .setOrigin(0.5, 1)
      .setDepth(9)
    this.bar = scene.add.graphics().setDepth(9)
    this.drawBar(this.shownHp)

    this.zone = scene.add.zone(at.x, at.y, 32, 32)
    scene.physics.add.existing(this.zone, true)

    this.parts = [this.aura, this.sprite, this.label, this.bar, this.zone]

    if (!reducedMotion) {
      scene.tweens.add({
        targets: this.sprite,
        y: at.y - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      scene.tweens.add({
        targets: this.aura,
        alpha: { from: 0.18, to: 0.42 },
        scale: { from: 0.9, to: 1.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  get currentHp(): number {
    return this.hp
  }

  private drawBar(value: number): void {
    const x = this.position.x - BAR_W / 2
    const y = this.position.y - 50
    const ratio = this.maxHp > 0 ? Phaser.Math.Clamp(value / this.maxHp, 0, 1) : 0
    this.bar.clear()
    this.bar.fillStyle(0x100d18, 0.85)
    this.bar.fillRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2)
    this.bar.fillStyle(0xb83d4a, 1)
    this.bar.fillRect(x, y, BAR_W * ratio, BAR_H)
  }

  /** Set HP; tweens the bar over ~300 ms unless reduced motion or animate is false. */
  setHp(value: number, animate: boolean): void {
    this.hp = Phaser.Math.Clamp(value, 0, this.maxHp)
    this.hpTween?.stop()
    this.hpTween = null
    if (!animate || this.reducedMotion) {
      this.shownHp = this.hp
      this.drawBar(this.shownHp)
      return
    }
    const state = { v: this.shownHp }
    this.hpTween = this.scene.tweens.add({
      targets: state,
      v: this.hp,
      duration: HP_TWEEN_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.shownHp = state.v
        this.drawBar(state.v)
      },
      onComplete: () => {
        this.shownHp = this.hp
        this.drawBar(this.hp)
        this.hpTween = null
      },
    })
  }

  /** Brief white hit flash (skipped for reduced motion). */
  flash(): void {
    if (this.reducedMotion) return
    this.sprite.setTintFill(0xffffff)
    this.scene.time.delayedCall(90, () => {
      if (this.sprite.active) this.sprite.clearTint()
    })
  }

  /** Horizontal nudge and back (lunge or knockback). Skipped for reduced motion. */
  nudge(dx: number, durationMs: number): void {
    if (this.reducedMotion) return
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.position.x + dx,
      duration: durationMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  /** Fade out, then mark not alive and disable the collision body. */
  defeat(): void {
    if (!this.alive) return
    this.alive = false
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    this.label.setVisible(false)
    this.bar.setVisible(false)
    if (this.reducedMotion) {
      this.sprite.setAlpha(0)
      this.aura.setAlpha(0)
      return
    }
    this.scene.tweens.add({
      targets: [this.sprite, this.aura],
      alpha: 0,
      y: '-=16',
      duration: 600,
      ease: 'Sine.easeIn',
    })
  }

  destroy(): void {
    this.hpTween?.stop()
    for (const p of this.parts) p.destroy()
  }
}
