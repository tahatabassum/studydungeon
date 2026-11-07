import { describe, expect, it } from 'vitest';
import { validatePixelMap } from '../pixelMap';
import { DECOR_SPRITES, ICONS, MONSTER_SPRITES, PLAYER_SPRITES, SPRITE_REGISTRY, getSprite } from './index';

describe('sprite registry', () => {
  it('every sprite passes validatePixelMap with no errors', () => {
    for (const map of Object.values(SPRITE_REGISTRY)) {
      expect(validatePixelMap(map), map.name).toEqual([]);
    }
  });

  it('names equal their registry key and are unique', () => {
    const entries = Object.entries(SPRITE_REGISTRY);
    for (const [key, map] of entries) expect(map.name).toBe(key);
    const total =
      Object.keys(MONSTER_SPRITES).length +
      Object.keys(PLAYER_SPRITES).length +
      Object.keys(ICONS).length +
      Object.keys(DECOR_SPRITES).length;
    expect(entries.length).toBe(total);
  });

  it('contains all five monster kinds and the player idle frame', () => {
    for (const kind of ['paper_wraith', 'toxic_slime', 'gear_golem', 'memory_eater', 'exam_warden']) {
      expect(getSprite(kind)).toBeDefined();
    }
    expect(getSprite('player_idle')).toBeDefined();
    expect(getSprite('nope')).toBeUndefined();
  });

  it('sizes stay within 32x32', () => {
    for (const map of Object.values(SPRITE_REGISTRY)) {
      expect(map.width).toBeLessThanOrEqual(32);
      expect(map.height).toBeLessThanOrEqual(32);
    }
  });
});
