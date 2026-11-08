import type Phaser from 'phaser'
import { placementsFor } from './decorPlacement'
import { WORLD_H, WORLD_W, type Point } from './RoomLayout'
import type { RoomTheme } from './roomTheme'

/** Depth of decor: above floor (0) and walls (1), below actors (7+). */
export const DECOR_DEPTH = 2
/** Depth of the light tint overlay: above decor and torch glow, below actors. */
const LIGHT_DEPTH = 4

/**
 * Creates the non-colliding decor sprites and light tint for one room.
 * Returns the created objects so the caller can destroy them on rebuild.
 */
export function decorateRoom(
  scene: Phaser.Scene,
  theme: RoomTheme,
  origin: Point,
): Phaser.GameObjects.GameObject[] {
  const made: Phaser.GameObjects.GameObject[] = []
  for (const p of placementsFor(theme, origin)) {
    if (!scene.textures.exists(p.sprite)) continue
    made.push(scene.add.image(p.x, p.y, p.sprite).setDepth(DECOR_DEPTH))
  }
  made.push(
    scene.add
      .rectangle(origin.x + WORLD_W / 2, origin.y + WORLD_H / 2, WORLD_W, WORLD_H, theme.light.tint, theme.light.alpha)
      .setDepth(LIGHT_DEPTH),
  )
  return made
}
