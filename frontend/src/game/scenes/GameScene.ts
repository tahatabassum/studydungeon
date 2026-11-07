import Phaser from 'phaser'
import { BRIDGE_KEY } from '../config'
import { Gate } from '../entities/Gate'
import { Monster } from '../entities/Monster'
import { Player } from '../entities/Player'
import { EffectsSystem } from '../systems/EffectsSystem'
import { InteractionSystem } from '../systems/InteractionSystem'
import { MovementSystem } from '../systems/MovementSystem'
import type { GameBridge, GamePhase, ToGameEvent } from '../events'
import {
  GATE,
  MONSTER_SPAWN,
  PILLARS,
  PLAYER_SPAWN,
  TILE,
  TORCHES,
  WORLD_H,
  WORLD_W,
  borderWallTiles,
  type Point,
} from '../world/RoomLayout'
import type { Room } from '@/types/api'

export class GameScene extends Phaser.Scene {
  walls!: Phaser.Physics.Arcade.StaticGroup
  gate: Gate | null = null
  player: Player | null = null
  private movement: MovementSystem | null = null
  monster: Monster | null = null
  private interaction: InteractionSystem | null = null
  private effects: EffectsSystem | null = null
  readonly spawn: { player: Point; monster: Point } = {
    player: { ...PLAYER_SPAWN },
    monster: { ...MONSTER_SPAWN },
  }
  room: Room | null = null
  phase: GamePhase = 'exploring'
  reducedMotion = false

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
      () => ({ player: this.player, monster: this.monster, gate: this.gate }),
      () => this.reducedMotion,
    )
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)

    const off = this.bridge?.onToGame((e) => this.handle(e))
    const cleanup = (): void => {
      off?.()
      this.effects?.cancel()
      this.destroyPlayer()
    }
    this.events.once('shutdown', cleanup)
    this.events.once('destroy', cleanup)

    this.bridge?.emit({ type: 'ready' })
  }

  /** Camera follows the given object (the player, from task 6.4). */
  followTarget(target: Phaser.GameObjects.GameObject): void {
    this.cameras.main.startFollow(target, true, 0.1, 0.1)
  }

  update(time: number): void {
    this.movement?.update(time)
    this.interaction?.update()
  }

  private destroyPlayer(): void {
    this.interaction?.destroy()
    this.interaction = null
    this.monster?.destroy()
    this.monster = null
    this.movement?.destroy()
    this.movement = null
    this.player?.destroy()
    this.player = null
  }

  private handle(e: ToGameEvent): void {
    switch (e.type) {
      case 'load-room':
        this.room = e.room
        this.buildRoom(e.room)
        break
      case 'set-phase':
        this.phase = e.phase
        break
      case 'set-reduced-motion':
        this.reducedMotion = e.value
        break
      case 'reset':
        if (this.room) this.buildRoom(this.room)
        break
      case 'room-cleared':
        this.effects?.openGate(this.gate)
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

  private clearRoom(): void {
    this.effects?.cancel()
    this.destroyPlayer()
    this.gate?.destroy()
    this.gate = null
    this.walls?.destroy(true)
    for (const o of this.built) o.destroy()
    this.built = []
    this.tweens.killAll()
  }

  private buildRoom(room: Room): void {
    this.clearRoom()
    this.drawFloor()

    this.walls = this.physics.add.staticGroup()
    for (const t of borderWallTiles()) this.walls.create(t.x, t.y, 'wall-tile').setDepth(1)
    for (const p of PILLARS) {
      for (let x = p.x; x < p.x + p.w; x += TILE) {
        for (let y = p.y; y < p.y + p.h; y += TILE) {
          this.walls.create(x + TILE / 2, y + TILE / 2, 'wall-tile').setDepth(1)
        }
      }
    }

    this.gate = new Gate(this, GATE, this.reducedMotion)
    this.drawTorches()

    this.track(
      this.add
        .text(this.scale.width / 2, 12, room.label, {
          fontFamily: 'serif',
          fontSize: '22px',
          color: '#F2E8D5',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(50),
    )

    this.cameras.main.stopFollow()
    this.cameras.main.centerOn(this.spawn.player.x, this.spawn.player.y)
    const player = new Player(this, this.spawn.player, this.reducedMotion)
    this.player = player
    this.monster = new Monster(this, room.monster, this.spawn.monster, this.reducedMotion)
    this.movement = new MovementSystem(this, player, () => this.phase === 'exploring', [
      this.walls,
      this.gate.zone,
      this.monster.zone,
    ])
    this.interaction = new InteractionSystem(
      this,
      player,
      this.monster,
      () => this.phase,
      this.bridge,
      this.reducedMotion,
    )
    this.followTarget(player)
  }

  private drawFloor(): void {
    const g = this.track(this.add.graphics().setDepth(0))
    const cols = WORLD_W / TILE
    const rows = WORLD_H / TILE
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const base = (c + r) % 2 === 0 ? 0x1a1424 : 0x211a2e
        // Deterministic subtle variation, no randomness so rebuilds look identical.
        const shade = ((c * 7 + r * 13) % 5) * 0x010101
        g.fillStyle(base + shade, 1)
        g.fillRect(c * TILE, r * TILE, TILE, TILE)
      }
    }
  }

  private drawTorches(): void {
    for (const t of TORCHES) {
      const glow = this.track(
        this.add
          .circle(t.x, t.y, 56, 0xe9a23b, 0.18)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(3),
      )
      this.track(this.add.circle(t.x, t.y, 5, 0xe9a23b, 1).setDepth(3))
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
