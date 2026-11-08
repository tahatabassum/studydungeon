import type Phaser from 'phaser'

/** Creates the small shared 'spark' dot texture once. */
export function ensureSparkTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('spark')) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0xffffff, 1)
  g.fillCircle(6, 6, 6)
  g.generateTexture('spark', 12, 12)
  g.destroy()
}
