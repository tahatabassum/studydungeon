import type { PixelMap } from '../pixelMap';
import { DECOR_SPRITES } from './decor';
import { ICONS } from './icons';
import { MONSTER_SPRITES } from './monsters';
import { PLAYER_SPRITES } from './player';

export { MONSTER_SPRITES } from './monsters';
export { PLAYER_SPRITES } from './player';
export { ICONS } from './icons';
export { DECOR_SPRITES } from './decor';

/** All sprites keyed by name (monster kinds, player frames, icons, decor). */
export const SPRITE_REGISTRY: Readonly<Record<string, PixelMap>> = {
  ...MONSTER_SPRITES,
  ...PLAYER_SPRITES,
  ...ICONS,
  ...DECOR_SPRITES,
};

/** Looks up a sprite by registry name; undefined when unknown. */
export function getSprite(name: string): PixelMap | undefined {
  return Object.prototype.hasOwnProperty.call(SPRITE_REGISTRY, name)
    ? SPRITE_REGISTRY[name]
    : undefined;
}
