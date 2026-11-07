import Phaser from 'phaser'
import type { Point } from '../world/RoomLayout'
import { getMonsterStyle, type MonsterStyle } from './monsterStyles'
import { COLORS, CSS_COLORS } from '../colors'
import { FONT_DISPLAY, FONT_LABEL } from '../fonts'

const BAR_W = 64
const BAR_H = 8
const BOSS_BAR_W = 128
const BOSS_BAR_H = 12
const HP_TWEEN_MS = 300
const DEATH_FADE_MS = 400

/** Pixel-art monster built from Room.monster data. Visual bob never moves the collision zone. */
export class Monster {
  readonly id: string
  readonly name: string
  readonly maxHp: number
  /** Static collision body (does not bob) so the player collides with the monster. */
  readonly zone: Phaser.GameObjects.Zone
  readonly position: Point
  readonly isBoss: boolean
  alive = true

  private hp: number
  private shownHp: number
  private readonly style: MonsterStyle
  private readonly barW: number
  private readonly barH: number
  private readonly barOffset: number
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly aura: Phaser.GameObjects.Ellipse
  private readonly label: Phaser.GameObjects.Text
  private readonly bar: Phaser.GameObjects.Graphics
  private hpTween: Phaser.Tweens.Tween | null = null
  private bobTween: Phaser.Tweens.Tween | null = null
  private auraTween: Phaser.Tweens.Tween | null = null
  private readonly parts: Phaser.GameObjects.GameObject[]

  constructor(
    private readonly scene: Phaser.Scene,
    data: { id: string; name: string; max_hp: number; kind?: string },
    at: Point,
    private readonly reducedMotion: boolean,
    isBoss = false,
  ) {
    this.id = data.id
    this.name = data.name
    this.maxHp = data.max_hp
    this.hp = data.max_hp
    this.shownHp = data.max_hp
    this.position = { ...at }
    this.isBoss = isBoss
    this.style = getMonsterStyle(data.kind, isBoss)
    this.barW = isBoss ? BOSS_BAR_W : BAR_W
    this.barH = isBoss ? BOSS_BAR_H : BAR_H

    this.sprite = scene.add
      .sprite(at.x, at.y, this.style.texture)
      .setScale(this.style.scale)
      .setDepth(8)
    if (this.style.tint !== 0xffffff) this.sprite.setTint(this.style.tint)
    this.barOffset = Math.round(this.sprite.displayHeight / 2) + 10

    // Boss gets a larger, stronger red glow (glowing eyes read through the aura).
    const auraSize = Math.max(this.sprite.displayWidth, this.sprite.displayHeight) * (isBoss ? 1.1 : 0.9)
    this.aura = scene.add
      .ellipse(at.x, at.y + 4, auraSize, auraSize, this.style.aura, isBoss ? 0.4 : 0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(7)
    this.label = scene.add
      .text(at.x, at.y - this.barOffset - 6, data.name, {
        fontFamily: isBoss ? FONT_DISPLAY : FONT_LABEL,
        fontSize: isBoss ? '20px' : '14px',
        color: CSS_COLORS.INK,
      })
      .setOrigin(0.5, 1)
      .setDepth(9)
    this.bar = scene.add.graphics().setDepth(9)
    this.drawBar(this.shownHp)

    this.zone = scene.add.zone(at.x, at.y, 32, 32)
    scene.physics.add.existing(this.zone, true)

    this.parts = [this.aura, this.sprite, this.label, this.bar, this.zone]

    if (!reducedMotion) {
      this.sprite.play(this.style.anims.idle)
      this.bobTween = scene.tweens.add({
        targets: this.sprite,
        y: at.y - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.auraTween = scene.tweens.add({
        targets: this.aura,
        alpha: { from: isBoss ? 0.28 : 0.18, to: isBoss ? 0.55 : 0.42 },
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
    const x = this.position.x - this.barW / 2
    const y = this.position.y - this.barOffset
    const ratio = this.maxHp > 0 ? Phaser.Math.Clamp(value / this.maxHp, 0, 1) : 0
    this.bar.clear()
    this.bar.fillStyle(COLORS.BG, 0.85)
    this.bar.fillRect(x - 1, y - 1, this.barW + 2, this.barH + 2)
    this.bar.fillStyle(COLORS.DANGER, 1)
    this.bar.fillRect(x, y, this.barW * ratio, this.barH)
  }

  /**
   * Set HP from the latest authoritative value; tweens the bar over ~300 ms unless
   * reduced motion or animate is false. Reaching 0 leads to the defeat visuals (idempotent).
   */
  setHp(value: number, animate: boolean): void {
    this.hp = Phaser.Math.Clamp(value, 0, this.maxHp)
    this.hpTween?.stop()
    this.hpTween = null
    if (!animate || this.reducedMotion) {
      this.shownHp = this.hp
      this.drawBar(this.shownHp)
      if (this.hp <= 0) this.defeat()
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
        if (this.hp <= 0) this.defeat()
      },
    })
  }

  /** Returns to the idle loop after a one-shot animation. */
  private readonly backToIdle = (): void => {
    if (this.alive && this.sprite.active) this.sprite.play(this.style.anims.idle)
  }

  private playOnce(key: string): void {
    if (this.reducedMotion || !this.alive || !this.sprite.active) return
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.backToIdle)
    this.sprite.play(key)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, this.backToIdle)
  }

  /** Attack animation (lean with accent highlight). No-op under reduced motion. */
  playAttack(): void {
    this.playOnce(this.style.anims.attack)
  }

  /** Hit animation (bright flash frames). No-op under reduced motion. */
  playHit(): void {
    this.playOnce(this.style.anims.hit)
  }

  /** Brief white hit flash (skipped for reduced motion). */
  flash(): void {
    if (this.reducedMotion) return
    this.sprite.setTintFill(0xffffff)
    this.scene.time.delayedCall(90, () => {
      if (!this.sprite.active) return
      this.sprite.clearTint()
      if (this.style.tint !== 0xffffff) this.sprite.setTint(this.style.tint)
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

  /** Plays the erosion animation, then fades out. Same as defeat(). */
  playDeath(): void {
    this.defeat()
  }

  /** Erosion frames then fade out; marks not alive and disables the collision body. Idempotent. */
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
    this.bobTween?.stop()
    this.bobTween = null
    this.auraTween?.stop()
    this.auraTween = null
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.backToIdle)
    this.sprite.clearTint()
    const fade = (): void => {
      if (!this.sprite.active) return
      this.scene.tweens.add({
        targets: [this.sprite, this.aura],
        alpha: 0,
        duration: DEATH_FADE_MS,
        ease: 'Sine.easeIn',
      })
    }
    this.sprite.play(this.style.anims.death)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, fade)
    this.scene.tweens.add({ targets: this.aura, alpha: 0.1, duration: 300 })
  }

  destroy(): void {
    this.hpTween?.stop()
    this.bobTween?.stop()
    this.auraTween?.stop()
    for (const p of this.parts) p.destroy()
  }
}
