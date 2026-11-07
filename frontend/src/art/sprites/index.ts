import type { PixelMap } from '../pixelMap';
import { ICONS } from './icons';
import { MONSTER_SPRITES } from './monsters';
import { PLAYER_SPRITES } from './player';

export { MONSTER_SPRITES } from './monsters';
export { PLAYER_SPRITES } from './player';
export { ICONS } from './icons';

/** All sprites keyed by name (monster kinds, player frames, icons). */
export const SPRITE_REGISTRY: Readonly<Record<string, PixelMap>> = {
  ...MONSTER_SPRITES,
  ...PLAYER_SPRITES,
  ...ICONS,
};

/** Looks up a sprite by registry name; undefined when unknown. */
export function getSprite(name: string): PixelMap | undefined {
  return Object.prototype.hasOwnProperty.call(SPRITE_REGISTRY, name)
    ? SPRITE_REGISTRY[name]
    : undefined;
}
