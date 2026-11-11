import Phaser from 'phaser'
import type { AnswerResult } from '@/types/api'
import { sfx } from '@/audio/sfx'
import { CSS_COLORS } from '../colors'
import type { GameBridge, GamePhase, RevenantSpawn } from '../events'
import { FONT_LABEL } from '../fonts'
import { REVENANT } from '../revenantLook'
import { glowKey } from '../textures/registerGlow'
import { REVENANT_TEXTURE, registerRevenant } from '../textures/registerRevenant'
import type { Point } from '../world/RoomLayout'
import type { Player } from '../entities/Player'
import { ObjectPool } from './objectPool'
import { REVENANT_HOVER, REVENANT_RANGE, revenantSlots } from './revenantSlots'
import { ensureSparkTexture } from './sparkTexture'

/** Revenants per room (Req 9.1). */
export const MAX_REVENANTS = 3
/** Sparks in the "memory laid to rest" effect, shared by every rest. */
export const REST_SPARKS = 6

const DEPTH_BODY = 12
const DEPTH_GLOW = 11.5
const DEPTH_FX = 22
const BODY_ALPHA = 0.62
const GLOW_ALPHA = 0.5
const APPEAR_MS = 700
const REST_MS = 900
const LUNGE_MS = 180
const MARKER_MS = 700

/** What the system needs from the scene, as getters so it holds no scene state of its own. */
export interface RevenantHost {
  player(): Player | null
  phase(): GamePhase
  reduced(): boolean
  /** Top-left world corner of a room, or null if unknown. */
  originOf(roomId: string): Point | null
  /** True once that room's monster is defeated (HP reached 0). */
  monsterDefeated(roomId: string): boolean
}

type HauntState = 'idle' | 'engaged' | 'resting'

interface Haunt {
  body: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Image
  id: string
  questionId: string
  x: number
  y: number
  /** Offset used by the lunge tween (the frame loop adds it to the resting point). */
  dx: number
  dy: number
  phase: number
  bornAt: number
  state: HauntState
}

/**
 * Up to 3 pooled Revenants (haunted memories), display only. They appear only after the room monster is
 * defeated, have no collider (so they never block the gate), and never touch the monster or its HP.
 * Engaging one emits `revenant-engaged`; React runs the same encounter and sends the backend result back
 * through `apply-result`, which the scene routes here while a Revenant is engaged. Nothing is allocated per
 * frame: the three ghosts, their glows, the rest sparks and the prompt are created once.
 */
export class RevenantSystem {
  private readonly haunts: ObjectPool<Haunt>
  private readonly sparks: ObjectPool<Phaser.GameObjects.Image>
  private readonly markers: ObjectPool<Phaser.GameObjects.Image>
  private readonly prompt: Phaser.GameObjects.Text
  /** The shown Revenants (at most 3), kept in a plain array so the frame loop allocates nothing. */
  private readonly shown: Haunt[] = []
  private pending: { roomId: string; list: RevenantSpawn[] } | null = null
  private engaged: Haunt | null = null
  private timers: Phaser.Time.TimerEvent[] = []
  private markerTimer: Phaser.Time.TimerEvent | null = null
  private finishPending: (() => void) | null = null
  private readonly onKey: (e: KeyboardEvent) => void
  /** Last scene time seen by update(), used to stamp newly shown Revenants. */
  private now = 0

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly host: RevenantHost,
  ) {
    registerRevenant(scene)
    ensureSparkTexture(scene)
    const bodyTexture = scene.textures.exists(REVENANT_TEXTURE) ? REVENANT_TEXTURE : 'spark'
    const glowTexture = scene.textures.exists(glowKey('cool')) ? glowKey('cool') : 'spark'

    this.haunts = new ObjectPool<Haunt>({
      create: () => ({
        glow: scene.add
          .image(0, 0, glowTexture)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(REVENANT.CYAN)
          .setDisplaySize(150, 150)
          .setDepth(DEPTH_GLOW)
          .setVisible(false),
        body: scene.add.image(0, 0, bodyTexture).setDepth(DEPTH_BODY).setVisible(false),
        id: '',
        questionId: '',
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        phase: 0,
        bornAt: 0,
        state: 'idle',
      }),
      reset: (h) => {
        h.state = 'idle'
        h.dx = 0
        h.dy = 0
        h.body.setAlpha(0).setScale(1).setVisible(true).setActive(true)
        h.glow.setAlpha(0).setScale(1).setVisible(true).setActive(true)
      },
      max: MAX_REVENANTS,
    })
    this.sparks = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      reset: (s) => s.setAlpha(0.9).setScale(0.7).setTint(REVENANT.CYAN).setVisible(true).setActive(true),
      max: REST_SPARKS,
    })
    this.markers = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark').setVisible(false),
      reset: (m) => m.setTint(REVENANT.CYAN).setScale(1.6).setAlpha(1).setVisible(true).setActive(true),
      max: 1,
    })
    this.prompt = scene.add
      .text(0, 0, 'Press E to face the memory', {
        fontFamily: FONT_LABEL,
        fontSize: '14px',
        color: CSS_COLORS.INK,
        backgroundColor: CSS_COLORS.BG,
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_FX)
      .setVisible(false)

    // Key events (not the shared Key objects the monster interaction consumes), so both systems coexist.
    this.onKey = (e) => {
      if (e.repeat) return
      this.tryEngage()
    }
    scene.input.keyboard?.on('keydown-E', this.onKey)
    scene.input.keyboard?.on('keydown-SPACE', this.onKey)
  }

  /** Revenants currently shown (idle, engaged or resting). */
  get activeCount(): number {
    return this.haunts.activeCount
  }

  /** Pooled objects in use by the rest effect (for the debug readout). */
  get fxCount(): number {
    return this.sparks.activeCount + this.markers.activeCount
  }

  /** Id of the engaged Revenant, or null. */
  get engagedId(): string | null {
    return this.engaged?.id ?? null
  }

  /**
   * Shows up to 3 Revenants for a room once its monster is defeated. A new request replaces the shown set;
   * an empty list clears it. If the monster is still alive the request waits for its defeat.
   */
  spawn(roomId: string, list: RevenantSpawn[]): void {
    this.clearShown()
    this.pending = list.length > 0 ? { roomId, list: list.slice(0, MAX_REVENANTS) } : null
    this.showPending()
  }

  private showPending(): void {
    const p = this.pending
    if (!p || !this.host.monsterDefeated(p.roomId)) return
    const origin = this.host.originOf(p.roomId)
    if (!origin) return
    this.pending = null
    const slots = revenantSlots(p.list.length, origin, p.list.map((r) => r.x))
    p.list.forEach((r, i) => {
      const h = this.haunts.acquire()
      if (!h) return
      h.id = r.id
      h.questionId = r.questionId
      h.x = slots[i].x
      h.y = slots[i].y
      h.phase = i * 2.1
      h.bornAt = this.now
      this.shown.push(h)
      this.place(h, this.now, this.host.reduced())
    })
  }

  /** Per-frame: bob and pulse the shown Revenants, show the prompt, and try a held-back spawn. No allocation. */
  update(time: number): void {
    this.now = time
    if (this.pending) this.showPending()
    const n = this.shown.length
    if (n === 0) {
      if (this.prompt.visible) this.prompt.setVisible(false)
      return
    }
    const reduced = this.host.reduced()
    for (let i = 0; i < n; i++) {
      const h = this.shown[i]
      if (h.state !== 'resting') this.place(h, time, reduced)
    }
    const near = this.engaged || this.host.phase() !== 'exploring' ? null : this.nearest()
    if (near) this.prompt.setPosition(near.x, near.y - 78).setVisible(true)
    else if (this.prompt.visible) this.prompt.setVisible(false)
  }

  private place(h: Haunt, time: number, reduced: boolean): void {
    const appear = reduced ? 1 : Math.min(1, Math.max(0, (time - h.bornAt) / APPEAR_MS))
    const bob = reduced ? 0 : Math.sin(time / 650 + h.phase) * REVENANT_HOVER
    const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(time / 420 + h.phase)
    h.body.setPosition(h.x + h.dx, h.y + h.dy + bob).setAlpha(BODY_ALPHA * appear * (h.state === 'engaged' ? 1.25 : 1))
    h.glow.setPosition(h.x + h.dx, h.y + h.dy + bob - 4).setAlpha(GLOW_ALPHA * appear * pulse)
  }

  /** The closest idle Revenant within range of the player, or null. Allocates nothing. */
  private nearest(): Haunt | null {
    const player = this.host.player()
    if (!player) return null
    let best: Haunt | null = null
    let bestD = REVENANT_RANGE * REVENANT_RANGE
    for (let i = 0; i < this.shown.length; i++) {
      const h = this.shown[i]
      if (h.state !== 'idle') continue
      const d = (player.x - h.x) ** 2 + (player.y - h.y) ** 2
      if (d <= bestD) {
        bestD = d
        best = h
      }
    }
    return best
  }

  /** Touch: the Engage button was pressed. Same path as E or Space. */
  requestEngage(): void {
    this.tryEngage()
  }

  /** Touch wording for the in-world prompt (called on a mode change, never per frame). */
  setTouchMode(on: boolean): void {
    this.prompt.setText(on ? 'Tap Engage to face the memory' : 'Press E to face the memory')
  }

  /** True while exploring with an idle Revenant in range and none engaged. Allocation free. */
  get canEngage(): boolean {
    return !this.engaged && this.host.phase() === 'exploring' && this.nearest() !== null
  }

  private tryEngage(): void {
    if (this.engaged || this.host.phase() !== 'exploring') return
    const h = this.nearest()
    if (!h) return
    this.engaged = h
    h.state = 'engaged'
    this.prompt.setVisible(false)
    this.bridge?.emit({ type: 'revenant-engaged', revenantId: h.id })
  }

  /**
   * Plays the outcome of an engaged Revenant's answer. Returns false when none is engaged, so the scene
   * passes the result to the combat effects instead. A correct answer lays the memory to rest; a wrong one
   * makes the ghost lash out at the player. Emits result-animation-done exactly once.
   */
  handleResult(result: AnswerResult): boolean {
    const h = this.engaged
    if (!h) return false
    this.finishPending?.()
    this.cancelTimers()
    let fired = false
    const finish = (): void => {
      if (fired) return
      fired = true
      this.finishPending = null
      if (!result.correct && this.engaged === h) {
        this.engaged = null
        if (h.state === 'engaged') h.state = 'idle'
      }
      this.bridge?.emit({ type: 'result-animation-done' })
    }
    this.finishPending = finish
    const reduced = this.host.reduced()
    if (result.correct) this.rest(h, reduced, finish)
    else this.lash(h, reduced, finish)
    // Safety net: always settle within about a second.
    this.timers.push(this.scene.time.delayedCall(1200, finish))
    return true
  }

  /** Correct answer: the ghost rises and fades with a few sparks and a soft chime. */
  private rest(h: Haunt, reduced: boolean, finish: () => void): void {
    h.state = 'resting'
    this.engaged = null
    sfx.play('rest')
    this.bridge?.emit({ type: 'revenant-rested', revenantId: h.id })
    if (reduced) {
      // Static marker: the ghost goes pale and a cyan dot marks the spot for a moment.
      h.body.setAlpha(0.25)
      h.glow.setAlpha(0.15)
      const m = this.markers.acquire()
      if (m) {
        m.setPosition(h.x, h.y - 10).setDepth(DEPTH_FX)
        this.markerTimer?.remove(false)
        this.markerTimer = this.scene.time.delayedCall(MARKER_MS, () => this.clearMarker())
      }
      this.timers.push(
        this.scene.time.delayedCall(MARKER_MS, () => this.releaseHaunt(h)),
        this.scene.time.delayedCall(250, finish),
      )
      return
    }
    const tweens = this.scene.tweens
    tweens.killTweensOf([h.body, h.glow])
    tweens.add({ targets: h.body, y: h.y - 70, alpha: 0, scale: 1.25, duration: REST_MS, ease: 'Sine.easeOut' })
    tweens.add({
      targets: h.glow,
      y: h.y - 74,
      alpha: 0,
      scale: 1.5,
      duration: REST_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.releaseHaunt(h),
    })
    for (let i = 0; i < REST_SPARKS; i++) {
      const s = this.sparks.acquire()
      if (!s) break
      const dx = (i - (REST_SPARKS - 1) / 2) * 12
      s.setPosition(h.x + dx, h.y + 4).setDepth(DEPTH_FX)
      tweens.add({
        targets: s,
        x: h.x + dx * 1.7,
        y: h.y - 56 - (i % 3) * 14,
        alpha: 0,
        scale: 0.2,
        delay: i * 45,
        duration: 760,
        ease: 'Sine.easeOut',
        onComplete: () => {
          s.setVisible(false)
          this.sparks.release(s)
        },
      })
    }
    this.timers.push(this.scene.time.delayedCall(600, finish))
  }

  /** Wrong answer: the ghost lunges at the player; the player flashes and the camera shakes briefly. */
  private lash(h: Haunt, reduced: boolean, finish: () => void): void {
    if (reduced) {
      this.timers.push(this.scene.time.delayedCall(0, finish))
      return
    }
    const player = this.host.player()
    const dx = player ? Math.sign(player.x - h.x) * 22 : 0
    const dy = player ? Math.sign(player.y - h.y) * 14 : 0
    this.scene.tweens.add({ targets: h, dx, dy, duration: LUNGE_MS, yoyo: true, ease: 'Quad.easeOut' })
    this.scene.tweens.add({ targets: h.glow, scale: 1.35, duration: LUNGE_MS, yoyo: true, ease: 'Quad.easeOut' })
    this.timers.push(
      this.scene.time.delayedCall(LUNGE_MS, () => {
        player?.flashHit()
        this.scene.cameras.main.shake(120, 0.004)
      }),
      this.scene.time.delayedCall(LUNGE_MS * 2 + 40, finish),
    )
  }

  /** The pop-up closed (retreat or end of the encounter): an unanswered engaged Revenant becomes idle again. */
  onEncounterClose(): void {
    const h = this.engaged
    if (!h) return
    this.engaged = null
    if (h.state === 'engaged') h.state = 'idle'
  }

  private releaseHaunt(h: Haunt): void {
    this.scene.tweens.killTweensOf([h.body, h.glow])
    h.body.setVisible(false)
    h.glow.setVisible(false)
    const at = this.shown.indexOf(h)
    if (at >= 0) this.shown.splice(at, 1)
    this.haunts.release(h)
  }

  private clearMarker(): void {
    this.markerTimer?.remove(false)
    this.markerTimer = null
    for (const m of this.markers.active()) {
      m.setVisible(false)
      this.markers.release(m)
    }
  }

  private cancelTimers(): void {
    for (const t of this.timers) t.remove(false)
    this.timers = []
  }

  private clearShown(): void {
    this.cancelTimers()
    this.finishPending = null
    for (const h of this.shown) {
      this.scene.tweens.killTweensOf([h, h.body, h.glow])
      h.body.setVisible(false)
      h.glow.setVisible(false)
    }
    this.shown.length = 0
    this.haunts.releaseAll()
    for (const s of this.sparks.active()) {
      this.scene.tweens.killTweensOf(s)
      s.setVisible(false)
    }
    this.sparks.releaseAll()
    this.clearMarker()
    this.engaged = null
    this.prompt.setVisible(false)
  }

  /** Drop everything (room rebuild or restart). */
  reset(): void {
    this.pending = null
    this.clearShown()
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-E', this.onKey)
    this.scene.input.keyboard?.off('keydown-SPACE', this.onKey)
    this.reset()
    this.haunts.clear((h) => {
      h.body.destroy()
      h.glow.destroy()
    })
    this.sparks.clear((o) => o.destroy())
    this.markers.clear((o) => o.destroy())
    this.prompt.destroy()
  }
}
