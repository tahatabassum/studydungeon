import Phaser from 'phaser'
import type { Point } from '../world/RoomLayout'
import { getMonsterStyle, type MonsterStyle } from './monsterStyles'
import { COLORS, CSS_COLORS } from '../colors'
import { FONT_DISPLAY, FONT_LABEL } from '../fonts'
import { glowKey } from '../textures/registerGlow'

const BAR_W = 64
const BAR_H = 8
const BOSS_BAR_W = 128
const BOSS_BAR_H = 12
const HP_TWEEN_MS = 300
const DEATH_FADE_MS = 400
/** Red-shifted resting tint for the enraged boss. */
const ENRAGED_TINT = 0xff9a8a

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
  /** True while the boss phase is enraged (tint shift and the heavier attack). Display only. */
  enraged = false

  /** Resting tint: the style tint, or the enraged red shift. */
  private baseTint: number
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
  private breathTween: Phaser.Tweens.Tween | null = null
  private readonly feetY: number
  /** When above 0, defeat() dissolves the body over this many ms (boss death sequence). */
  private dissolveMs = 0
  private eyes: Phaser.GameObjects.Image[] = []
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
    this.baseTint = this.style.tint
    this.barW = isBoss ? BOSS_BAR_W : BAR_W
    this.barH = isBoss ? BOSS_BAR_H : BAR_H

    // Feet-anchored sprite (origin bottom center) so breathing and intro scale from the ground.
    this.sprite = scene.add
      .sprite(at.x, at.y, this.style.texture)
      .setScale(this.style.scale)
      .setOrigin(0.5, 1)
      .setDepth(8)
    this.feetY = at.y + Math.round(this.sprite.displayHeight / 2)
    this.sprite.setY(this.feetY)
    if (this.baseTint !== 0xffffff) this.sprite.setTint(this.baseTint)
    this.barOffset = Math.round(this.sprite.displayHeight / 2) + 10

    // Two small glowing eye points that follow the sprite (updated in tick()).
    const eyeKey = glowKey('warm')
    this.eyes = scene.textures.exists(eyeKey)
      ? [0, 1].map(() =>
          scene.add
            .image(at.x, at.y, eyeKey)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(14, 14)
            .setTint(this.style.aura)
            .setDepth(8.5),
        )
      : []

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

    this.parts = [this.aura, this.sprite, this.label, this.bar, this.zone, ...this.eyes]

    if (!reducedMotion) {
      this.sprite.play(this.style.anims.idle)
      this.bobTween = scene.tweens.add({
        targets: this.sprite,
        y: this.feetY - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.startBreathing()
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

  /** World y of the feet (ground contact), for glow ring and shadow. */
  get footY(): number {
    return this.feetY
  }

  /** Idle breathing: scaleY 1 to 1.03 over 1.8 s, anchored at the feet. */
  private startBreathing(): void {
    if (this.reducedMotion) return
    this.breathTween?.stop()
    this.breathTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleY: this.style.scale * 1.03,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Keep the glowing eyes on the sprite. No allocation; call each frame for the active monster. */
  tick(time: number): void {
    if (!this.alive) return
    const eyeY = this.sprite.y - this.sprite.displayHeight * 0.62
    const dx = this.sprite.displayWidth * 0.12
    const pulse = this.reducedMotion ? 0.9 : 0.75 + 0.2 * Math.sin(time / 420)
    for (let i = 0; i < this.eyes.length; i++) {
      this.eyes[i].setPosition(this.sprite.x + (i === 0 ? -dx : dx), eyeY).setAlpha(pulse)
    }
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
    if (this.enraged) this.roar()
    else this.windUp()
  }

  /** Re-applies the resting tint after a flash or wind-up. */
  private restoreTint(): void {
    this.sprite.clearTint()
    if (this.baseTint !== 0xffffff) this.sprite.setTint(this.baseTint)
  }

  /**
   * Enraged phase look: a red tint shift on the sprite, a red aura and red eyes. This is the only
   * enraged effect under reduced motion (tint only). Idempotent; display only.
   */
  setEnraged(on: boolean): void {
    if (this.enraged === on) return
    this.enraged = on
    this.baseTint = on ? ENRAGED_TINT : this.style.tint
    if (!this.alive || !this.sprite.active) return
    this.restoreTint()
    this.aura.setFillStyle(on ? COLORS.DANGER : this.style.aura, this.isBoss ? 0.4 : 0.3)
    for (const e of this.eyes) e.setTint(on ? COLORS.DANGER : this.style.aura)
  }

  /**
   * Enraged attack: a heavier lunge and roar. The sprite rears back further than the normal
   * wind-up, the eyes flare wide and the body flashes red. Runs inside the existing lunge window,
   * so combat timing is unchanged. Skipped when reduced.
   */
  private roar(): void {
    if (this.reducedMotion || !this.alive || !this.sprite.active) return
    this.sprite.setTint(COLORS.DANGER)
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: 0, to: -12 },
      duration: 140,
      yoyo: true,
      hold: 90,
      ease: 'Back.easeOut',
    })
    if (this.eyes.length > 0) {
      const rest = this.eyes[0].scale
      this.scene.tweens.add({
        targets: this.eyes,
        scale: { from: rest * 3, to: rest },
        duration: 420,
        ease: 'Cubic.easeOut',
      })
    }
    this.scene.time.delayedCall(320, () => {
      if (!this.sprite.active) return
      this.restoreTint()
      this.sprite.setAngle(0)
    })
  }

  /**
   * Wind-up pose over the existing lunge window: lean back about 6 px and warm tint for 200 ms.
   * Runs alongside the attack animation, so combat timing is unchanged. Skipped when reduced.
   */
  private windUp(): void {
    if (this.reducedMotion || !this.alive || !this.sprite.active) return
    this.sprite.setTint(COLORS.EMBER)
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: 0, to: -6 },
      duration: 80,
      yoyo: true,
      hold: 40,
      ease: 'Sine.easeOut',
    })
    this.scene.time.delayedCall(200, () => {
      if (!this.sprite.active) return
      this.restoreTint()
      this.sprite.setAngle(0)
    })
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
      this.restoreTint()
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

  /**
   * Knockback on a hit: the sprite is pushed `px` away from the player and springs back. Skipped when reduced
   * or `px` is 0. Uses the same tween target as nudge, so it never moves the collision zone.
   */
  knockback(dir: -1 | 1, px: number): void {
    if (this.reducedMotion || px <= 0 || !this.alive || !this.sprite.active) return
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.position.x + dir * px,
      duration: 70,
      yoyo: true,
      ease: 'Cubic.easeOut',
    })
  }

  /**
   * Boss death: the next defeat() dissolves the body over `ms` (a plain fade under reduced motion)
   * instead of the normal erosion frames. Call before the monster is defeated. Display only.
   */
  prepareDissolve(ms: number): void {
    this.dissolveMs = ms
  }

  /** Scale/fade-in the first time the player enters this room. Static under reduced motion. */
  playIntro(): void {
    if (this.reducedMotion || !this.alive || !this.sprite.active) return
    const target = this.style.scale
    this.breathTween?.stop()
    this.breathTween = null
    this.sprite.setAlpha(0).setScale(target * (this.isBoss ? 0.5 : 0.7))
    if (this.isBoss && this.eyes.length > 0) {
      // Dramatic entrance: the glowing eyes flare wide, then settle (one-shot; visual only).
      const rest = this.eyes[0].scale
      this.scene.tweens.add({
        targets: this.eyes,
        scale: { from: rest * 3.5, to: rest },
        duration: 900,
        ease: 'Cubic.easeOut',
      })
    }
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scale: target,
      duration: this.isBoss ? 650 : 300,
      delay: this.isBoss ? 120 : 0,
      ease: this.isBoss ? 'Back.easeOut' : 'Sine.easeOut',
      onComplete: () => {
        if (this.alive && this.sprite.active) this.startBreathing()
      },
    })
  }

  /** Plays the erosion animation, then fades out. Same as defeat(). */
  playDeath(): void {
    this.defeat()
  }

  /**
   * Removes the monster at once, with no animation: used for display-only rooms that hold no monster
   * (the Haunted Hall). Marks it not alive, hides every part and disables the collision body. Idempotent.
   */
  retire(): void {
    if (!this.alive) return
    this.alive = false
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    this.bobTween?.stop()
    this.bobTween = null
    this.auraTween?.stop()
    this.auraTween = null
    this.breathTween?.stop()
    this.breathTween = null
    for (const p of this.parts) {
      if (p !== this.zone) (p as Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }).setVisible(false)
    }
  }

  /** Erosion frames then fade out; marks not alive and disables the collision body. Idempotent. */
  defeat(): void {
    if (!this.alive) return
    this.alive = false
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    this.label.setVisible(false)
    this.bar.setVisible(false)
    for (const e of this.eyes) e.setVisible(false)
    if (this.dissolveMs > 0) {
      this.breathTween?.stop()
      this.breathTween = null
      this.bobTween?.stop()
      this.bobTween = null
      this.auraTween?.stop()
      this.auraTween = null
      this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.backToIdle)
      this.sprite.clearTint()
      // Reduced motion: a plain fade. Otherwise the body lifts and thins out while it fades.
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleY: this.reducedMotion ? this.sprite.scaleY : this.sprite.scaleY * 1.14,
        scaleX: this.reducedMotion ? this.sprite.scaleX : this.sprite.scaleX * 0.9,
        duration: this.dissolveMs,
        ease: 'Sine.easeIn',
      })
      this.scene.tweens.add({ targets: this.aura, alpha: 0, duration: this.dissolveMs })
      return
    }
    if (this.reducedMotion) {
      this.sprite.setAlpha(0)
      this.aura.setAlpha(0)
      return
    }
    this.breathTween?.stop()
    this.breathTween = null
    this.bobTween?.stop()
    this.bobTween = null
    this.auraTween?.stop()
    this.auraTween = null
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.backToIdle)
    this.sprite.clearTint()
    const fade = (): void => {
      if (!this.sprite.active) return
      // Spark poof: the 8 pooled sparks come from EffectsSystem.burst; here the body shrinks away.
      this.scene.tweens.add({
        targets: [this.sprite, this.aura],
        alpha: 0,
        duration: DEATH_FADE_MS,
        ease: 'Sine.easeIn',
      })
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: this.sprite.scaleX * 0.6,
        scaleY: this.sprite.scaleY * 0.6,
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
    this.breathTween?.stop()
    for (const p of this.parts) p.destroy()
  }
}
