import Phaser from 'phaser'
import { BRIDGE_KEY, GAME_HEIGHT } from '../config'
import { clampViewInset } from '../world/viewInset'
import { Gate } from '../entities/Gate'
import { Monster } from '../entities/Monster'
import { Player } from '../entities/Player'
import { AtmosphereSystem } from '../systems/AtmosphereSystem'
import { EffectsSystem } from '../systems/EffectsSystem'
import { InteractionSystem } from '../systems/InteractionSystem'
import { MovementSystem } from '../systems/MovementSystem'
import { RoomTracker } from '../systems/RoomTracker'
import type { FromGameEvent, GameBridge, GamePhase, ToGameEvent } from '../events'
import { buildDungeonLayout, type DungeonLayout } from '../world/DungeonLayout'
import { decorateRoom } from '../world/RoomDecorator'
import { selectTheme, type RoomTheme } from '../world/roomTheme'
import {
  MONSTER_SPAWN,
  TILE,
  WORLD_H,
  WORLD_W,
  borderWallTiles,
  pillarsFor,
  torchesFor,
  type Point,
} from '../world/RoomLayout'
import type { Room } from '@/types/api'
import { COLORS, CSS_COLORS } from '../colors'
import { FONT_DISPLAY } from '../fonts'

export class GameScene extends Phaser.Scene {
  walls: Phaser.Physics.Arcade.StaticGroup | null = null
  player: Player | null = null
  layout: DungeonLayout | null = null
  rooms: Room[] = []
  phase: GamePhase = 'exploring'
  reducedMotion = false
  /** Stored for the later audio spec; no sound is played yet. */
  muted = false
  /** Fraction of the view covered by the docked question panel (display only). */
  viewInset = 0

  private insetTween: Phaser.Tweens.Tween | null = null
  private movement: MovementSystem | null = null
  private interaction: InteractionSystem | null = null
  private effects: EffectsSystem | null = null
  private tracker: RoomTracker | null = null
  private atmosphere: AtmosphereSystem | null = null
  /** Per-room theme/origin/boss flag, used for ambience and entrances. */
  private roomInfo = new Map<string, { theme: RoomTheme; origin: Point; boss: boolean }>()
  /** Rooms whose monster intro has already played. */
  private introduced = new Set<string>()
  /** Exit gate per room id (rooms without a following room have none). */
  private gates = new Map<string, Gate>()
  private monsters = new Map<string, Monster>() // room id -> monster
  private activeMonster: Monster | null = null

  private bridge: GameBridge | undefined
  private built: Phaser.GameObjects.GameObject[] = []

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.bridge = this.registry.get(BRIDGE_KEY) as GameBridge | undefined
    this.effects = new EffectsSystem(
      this,
      this.bridge,
      () => ({
        player: this.player,
        monster: this.activeMonster ?? this.currentMonster(),
        // Gates open only on an explicit gate-open event.
        gate: null,
      }),
      () => this.reducedMotion,
    )
    this.atmosphere = new AtmosphereSystem(this, () => this.reducedMotion)

    const off = this.bridge?.onToGame((e) => this.handle(e))
    const cleanup = (): void => {
      off?.()
      this.effects?.destroy()
      this.atmosphere?.destroy()
      this.atmosphere = null
      this.destroyActors()
    }
    this.events.once('shutdown', cleanup)
    this.events.once('destroy', cleanup)

    this.bridge?.emit({ type: 'ready' })
  }

  /** Camera follows the given object. */
  followTarget(target: Phaser.GameObjects.GameObject): void {
    this.cameras.main.startFollow(target, true, 0.1, 0.1)
    this.applyViewInset(false)
  }

  /**
   * Phaser centers the camera on (target.y - followOffset.y). A positive y
   * offset therefore puts the camera center ABOVE the target (target drawn
   * lower). To draw the target higher, in the middle of the visible area
   * above the panel (height H*(1-f)), the camera center must move below the
   * target by f*H/2, so the offset is negative. Camera bounds still clamp.
   */
  private applyViewInset(animate: boolean): void {
    const cam = this.cameras.main
    const targetY = -(this.viewInset * GAME_HEIGHT) / 2
    this.insetTween?.stop()
    this.insetTween = null
    if (animate && !this.reducedMotion) {
      const state = { y: cam.followOffset.y }
      this.insetTween = this.tweens.add({
        targets: state,
        y: targetY,
        duration: 200,
        ease: 'Sine.easeOut',
        onUpdate: () => cam.setFollowOffset(0, state.y),
        onComplete: () => {
          this.insetTween = null
        },
      })
    } else {
      cam.setFollowOffset(0, targetY)
    }
  }

  update(time: number): void {
    this.movement?.update(time)
    this.interaction?.update()
    this.tracker?.update()
  }

  private currentMonster(): Monster | null {
    const id = this.tracker?.currentRoomId
    return id ? (this.monsters.get(id) ?? null) : null
  }

  private destroyActors(): void {
    this.interaction?.destroy()
    this.interaction = null
    this.movement?.destroy()
    this.movement = null
    this.tracker = null
    for (const m of this.monsters.values()) m.destroy()
    this.monsters.clear()
    this.activeMonster = null
    this.player?.destroy()
    this.player = null
  }

  private handle(e: ToGameEvent): void {
    switch (e.type) {
      case 'load-dungeon':
        this.rooms = e.rooms
        this.build()
        break
      case 'set-phase':
        this.phase = e.phase
        break
      case 'set-reduced-motion':
        this.reducedMotion = e.value
        break
      case 'set-muted':
        this.muted = e.value
        break
      case 'set-view-inset':
        this.viewInset = clampViewInset(e.bottomFraction)
        this.applyViewInset(true)
        break
      case 'reset':
        if (this.rooms.length > 0) this.build()
        break
      case 'gate-open':
        this.gates.get(e.roomId)?.open()
        break
      case 'apply-result':
        this.effects?.apply(e.result)
        break
    }
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.built.push(obj)
    return obj
  }

  /** Ambience, room fade, monster intro and boss entrance when the player enters a room. */
  private onRoomChange(roomId: string, first: boolean): void {
    const info = this.roomInfo.get(roomId)
    if (!info) return
    this.atmosphere?.setRoom(info.theme, info.origin)
    const cam = this.cameras.main
    const intro = !this.introduced.has(roomId)
    if (!first && !this.reducedMotion && !(info.boss && intro)) cam.fadeIn(180, 0, 0, 0)
    if (!intro) return
    this.introduced.add(roomId)
    this.monsters.get(roomId)?.playIntro()
    if (info.boss && !this.reducedMotion) {
      cam.shake(120, 0.006)
      cam.flash(220, 200, 30, 50)
    }
  }

  private teardown(): void {
    this.effects?.reset()
    this.atmosphere?.clearRoom()
    this.roomInfo.clear()
    this.introduced.clear()
    this.destroyActors()
    for (const g of this.gates.values()) g.destroy()
    this.gates.clear()
    this.walls?.destroy(true)
    this.walls = null
    for (const o of this.built) o.destroy()
    this.built = []
    this.tweens.killAll()
  }

  private build(): void {
    this.teardown()
    const result = buildDungeonLayout(this.rooms)
    if (!result.ok) {
      this.layout = null
      console.error(`GameScene: invalid dungeon data (${result.error})`)
      return
    }
    const layout = result.layout
    this.layout = layout
    const last = layout.rooms[layout.rooms.length - 1]
    if (layout.rooms.some((r) => r.isBoss && r.id !== last.id)) {
      console.warn('GameScene: boss room is not the highest order room')
    }

    this.physics.world.setBounds(layout.world.x, layout.world.y, layout.world.w, layout.world.h)
    this.cameras.main.setBounds(layout.world.x, layout.world.y, layout.world.w, layout.world.h)

    this.walls = this.physics.add.staticGroup()
    const walls = this.walls
    const roomById = new Map(this.rooms.map((r) => [r.id, r]))

    layout.rooms.forEach((b, k) => {
      const origin: Point = { x: b.rect.x, y: b.rect.y }
      const hasExit = k < layout.rooms.length - 1
      const opts = { origin, exitGap: hasExit, entryGap: k > 0 }
      const room = roomById.get(b.id)
      // Theme comes only from room data (monster kind and boss flag).
      const theme = selectTheme(room?.monster.kind, room?.is_boss ?? b.isBoss)
      this.roomInfo.set(b.id, { theme, origin, boss: b.isBoss })
      this.drawFloor(origin, theme)
      for (const o of decorateRoom(this, theme, origin)) this.track(o)
      for (const t of borderWallTiles(opts)) walls.create(t.x, t.y, 'wall-tile').setDepth(1)
      for (const p of pillarsFor(opts)) {
        for (let x = p.x; x < p.x + p.w; x += TILE) {
          for (let y = p.y; y < p.y + p.h; y += TILE) {
            walls.create(x + TILE / 2, y + TILE / 2, 'wall-tile').setDepth(1)
          }
        }
      }
      this.drawTorches(torchesFor(opts))
      if (room) {
        this.track(
          this.add
            .text(origin.x + WORLD_W / 2, origin.y + TILE + 6, room.label, {
              fontFamily: FONT_DISPLAY,
              fontSize: '22px',
              color: CSS_COLORS.INK,
            })
            .setOrigin(0.5, 0)
            .setDepth(50),
        )
      }
    })

    for (const spec of layout.gates) {
      this.gates.set(
        spec.afterRoomId,
        Gate.fromSpec(this, spec, this.reducedMotion, (roomId) =>
          this.bridge?.emit({ type: 'gate-opened', roomId } satisfies FromGameEvent),
          (x, y) => this.effects?.puff(x, y),
        ),
      )
    }

    const player = new Player(this, layout.spawn, this.reducedMotion)
    this.player = player
    for (const b of layout.rooms) {
      const room = roomById.get(b.id)
      if (!room) continue
      const at = { x: MONSTER_SPAWN.x + b.rect.x, y: MONSTER_SPAWN.y + b.rect.y }
      this.monsters.set(
        b.id,
        new Monster(this, room.monster, at, this.reducedMotion, b.isBoss),
      )
    }

    const obstacles: Phaser.Types.Physics.Arcade.ArcadeColliderType[] = [walls]
    for (const g of this.gates.values()) obstacles.push(g.zone)
    for (const m of this.monsters.values()) obstacles.push(m.zone)
    this.movement = new MovementSystem(this, player, () => this.phase === 'exploring', obstacles)

    this.tracker = new RoomTracker(
      layout,
      () => ({ x: player.x, y: player.y }),
      this.bridge,
      (id, first) => this.onRoomChange(id, first),
    )
    // Record which monster started the encounter so effects target it.
    const bridge = this.bridge
    const wrapped: GameBridge | undefined = bridge && {
      ...bridge,
      emit: (ev) => {
        if (ev.type === 'encounter-started') {
          for (const m of this.monsters.values()) if (m.id === ev.monsterId) this.activeMonster = m
        }
        bridge.emit(ev)
      },
    }
    this.interaction = new InteractionSystem(
      this,
      player,
      () => this.currentMonster(),
      () => this.phase,
      wrapped,
      this.reducedMotion,
    )

    this.cameras.main.stopFollow()
    this.cameras.main.centerOn(layout.spawn.x, layout.spawn.y)
    this.followTarget(player)
  }

  private drawFloor(origin: Point, theme: RoomTheme): void {
    const g = this.track(this.add.graphics().setDepth(0))
    const cols = WORLD_W / TILE
    const rows = WORLD_H / TILE
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const base = (c + r) % 2 === 0 ? theme.floor[0] : theme.floor[1]
        // Deterministic subtle variation, no randomness so rebuilds look identical.
        const shade = ((c * 7 + r * 13) % 5) * 0x010101
        g.fillStyle(base + shade, 1)
        g.fillRect(origin.x + c * TILE, origin.y + r * TILE, TILE, TILE)
      }
    }
  }

  private drawTorches(torches: Point[]): void {
    for (const t of torches) {
      const glow = this.track(
        this.add
          .circle(t.x, t.y, 56, COLORS.ACCENT, 0.18)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(3),
      )
      this.track(this.add.circle(t.x, t.y, 5, COLORS.ACCENT, 1).setDepth(3))
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.12, to: 0.26 },
          scale: { from: 0.92, to: 1.08 },
          duration: 400 + ((t.x + t.y) % 300),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }
  }
}
