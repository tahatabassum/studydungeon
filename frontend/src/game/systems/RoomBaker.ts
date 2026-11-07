import type Phaser from 'phaser'
import { drawRoom } from '@/art/room'
import { hashString } from '@/art/room/rng'
import type { RoomTheme } from '../world/roomTheme'
import { WORLD_H, WORLD_W, type Point } from '../world/RoomLayout'

/** Bytes of one baked room texture (RGBA). */
export const ROOM_TEXTURE_BYTES = WORLD_W * WORLD_H * 4

export interface BakeOptions {
  exitGap: boolean
  entryGap: boolean
}

interface Baked {
  key: string
  image: Phaser.GameObjects.Image
}

/**
 * Bakes all static decoration of a room into one CanvasTexture (1280x800) shown as one image.
 * Rooms are baked lazily and released when no longer near the player.
 */
export class RoomBaker {
  private readonly baked = new Map<string, Baked>()
  private warned = false

  constructor(private readonly scene: Pick<Phaser.Scene, 'textures' | 'add'>) {}

  has(roomId: string): boolean {
    return this.baked.has(roomId)
  }

  /**
   * Bake a room and return its texture key, or null when the canvas is unavailable
   * (the caller falls back to the Graphics floor). Baking an already baked room is a no-op.
   */
  bake(roomId: string, theme: RoomTheme, origin: Point, opts: BakeOptions): string | null {
    const existing = this.baked.get(roomId)
    if (existing) return existing.key
    const key = `room_bake_${roomId}`
    try {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
      const tex = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H)
      const ctx = tex?.getContext() ?? null
      if (!tex || !ctx) throw new Error('canvas context unavailable')
      drawRoom(ctx, theme, { ...opts, seed: hashString(roomId) })
      tex.refresh()
      const image = this.scene.add.image(origin.x, origin.y, key).setOrigin(0, 0).setDepth(0)
      this.baked.set(roomId, { key, image })
      return key
    } catch (err) {
      if (!this.warned) {
        this.warned = true
        console.warn('RoomBaker: falling back to the Graphics floor', err)
      }
      return null
    }
  }

  /** Destroy a baked room's image and texture. */
  release(roomId: string): void {
    const b = this.baked.get(roomId)
    if (!b) return
    b.image.destroy()
    if (this.scene.textures.exists(b.key)) this.scene.textures.remove(b.key)
    this.baked.delete(roomId)
  }

  releaseAll(): void {
    for (const id of [...this.baked.keys()]) this.release(id)
  }

  /** Estimated texture memory held by baked rooms. */
  estimatedBytes(): number {
    return this.baked.size * ROOM_TEXTURE_BYTES
  }
}
