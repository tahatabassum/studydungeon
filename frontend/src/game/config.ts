import Phaser from 'phaser'
import type { GameBridge } from './events'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { CSS_COLORS } from './colors'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
/** Registry key under which the Event_Bridge is stored. */
export const BRIDGE_KEY = 'bridge'

export function createGameConfig(
  parent: HTMLElement,
  bridge: GameBridge,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: CSS_COLORS.BG,
    pixelArt: false,
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
