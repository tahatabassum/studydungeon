import Phaser from 'phaser'
import { CSS_COLORS } from '../colors'
import { debugRequested } from '../rendererQuery'
import type { Rect } from '../viewport'

const REFRESH_MS = 500
const MIB = 1024 * 1024
/** Total texture memory cap in MiB (shown in red above this). */
export const TEXTURE_CAP_MIB = 32

export interface DebugSources {
  ambientCount: () => number
  textureBytes: () => number
  /** Optional readout line: viewport size, zoom, canvas size, HUD mode. */
  viewport?: () => string
}

/**
 * Dev-only readout: fps, ambient particles, tween count, renderer type, texture MiB.
 * Toggle with ?debug=1 or F3. When off it does no work (update returns at once).
 */
export class DebugOverlay {
  private text: Phaser.GameObjects.Text | null = null
  private enabled = false
  private rect: Rect = { x: 0, y: 0, w: 960, h: 540 }
  private zoom = 1
  private nextRefresh = 0
  private readonly onKey: () => void

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sources: DebugSources,
    search: string = typeof window === 'undefined' ? '' : window.location.search,
  ) {
    this.onKey = () => this.setEnabled(!this.enabled)
    scene.input.keyboard?.on('keydown-F3', this.onKey)
    if (debugRequested(search)) this.setEnabled(true)
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (on && !this.text) {
      this.text = this.scene.add
        .text(8, 8, '', { fontFamily: 'monospace', fontSize: '12px', color: CSS_COLORS.GHOST, backgroundColor: '#000000aa' })
        .setScrollFactor(0)
        .setDepth(200)
    }
    this.text?.setVisible(on)
    this.nextRefresh = 0
    this.place()
  }

  /** Keep the readout pinned to the screen corner at any camera zoom (set on resize). */
  setScreenRect(r: Rect, zoom: number): void {
    this.rect = r
    this.zoom = zoom > 0 ? zoom : 1
    this.place()
  }

  private place(): void {
    this.text?.setPosition(this.rect.x + 8 / this.zoom, this.rect.y + 8 / this.zoom).setScale(1 / this.zoom)
    this.nextRefresh = 0
  }

  update(time: number): void {
    if (!this.enabled || !this.text || time < this.nextRefresh) return
    this.nextRefresh = time + REFRESH_MS
    const game = this.scene.game
    const mib = this.sources.textureBytes() / MIB
    const renderer = game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'
    this.text.setText(
      `fps ${Math.round(game.loop.actualFps)}  ambient ${this.sources.ambientCount()}  tweens ${this.scene.tweens.getTweens().length}\n` +
        `renderer ${renderer}  texture ${mib.toFixed(1)} MiB / ${TEXTURE_CAP_MIB}` +
        (this.sources.viewport ? `\n${this.sources.viewport()}` : ''),
    )
    this.text.setColor(mib > TEXTURE_CAP_MIB ? CSS_COLORS.DANGER : CSS_COLORS.GHOST)
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F3', this.onKey)
    this.text?.destroy()
    this.text = null
  }
}
