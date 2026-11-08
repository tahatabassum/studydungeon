import Phaser from 'phaser'
import type { GameBridge } from './events'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { CSS_COLORS } from './colors'
import { rendererFromSearch } from './rendererQuery'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
/** Registry key under which the Event_Bridge is stored. */
export const BRIDGE_KEY = 'bridge'
/** Camera zoom (D3). Rooms never fit whole at any zoom, so the follow camera stays at 1.0. */
export const CAMERA_ZOOM = 1

function rendererType(): number {
  const search = typeof window === 'undefined' ? '' : window.location.search
  return rendererFromSearch(search) === 'canvas' ? Phaser.CANVAS : Phaser.AUTO
}

export function createGameConfig(
  parent: HTMLElement,
  bridge: GameBridge,
): Phaser.Types.Core.GameConfig {
  return {
    type: rendererType(),
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: CSS_COLORS.BG,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, GameScene],
    callbacks: {
      // Runs before scenes boot, so the bridge is available in every create().
      preBoot: (game) => {
        game.registry.set(BRIDGE_KEY, bridge)
      },
    },
  }
}
