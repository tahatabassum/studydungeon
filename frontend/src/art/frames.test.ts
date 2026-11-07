import { describe, expect, it } from 'vitest';
import { PAD_X, PAD_Y, animKey, deriveFrames, frameName, type FrameKind } from './frames';
import { validatePixelMap, type PixelMap } from './pixelMap';
import { MONSTER_SPRITES, PLAYER_SPRITES } from './sprites';

const KINDS: FrameKind[] = ['idle', 'attack', 'hit', 'death', 'walk'];
const COUNTS: Record<FrameKind, number> = { idle: 2, attack: 3, hit: 2, death: 3, walk: 2 };

function pixels(map: PixelMap): number {
  return map.rows.reduce((n, r) => n + Array.from(r).filter((c) => c !== '.').length, 0);
}

describe('deriveFrames', () => {
  const bases = [...Object.values(MONSTER_SPRITES), PLAYER_SPRITES.player_idle];

  it('every derived frame validates and has padded dimensions', () => {
    for (const base of bases) {
      for (const kind of KINDS) {
        const frames = deriveFrames(base, kind);
        expect(frames).toHaveLength(COUNTS[kind]);
        frames.forEach((f, i) => {
          expect(validatePixelMap(f, true), f.name).toEqual([]);
          expect(f.name).toBe(frameName(base.name, kind, i));
          expect(f.width).toBe(base.width + PAD_X * 2);
          expect(f.height).toBe(base.height + PAD_Y * 2);
        });
      }
    }
  });

  it('idle frame 0 keeps every base pixel and frame 1 is bobbed up by one row', () => {
    const base = MONSTER_SPRITES.toxic_slime;
    const [a, b] = deriveFrames(base, 'idle');
    expect(pixels(a)).toBe(pixels(base));
    expect(pixels(b)).toBe(pixels(base));
    expect(b.rows[PAD_Y - 1 + 0]).toBe(a.rows[PAD_Y]);
  });

  it('hit frames are single-colored flashes', () => {
    for (const f of deriveFrames(MONSTER_SPRITES.gear_golem, 'hit')) {
      expect(new Set(f.rows.join('').replaceAll('.', '')).size).toBe(1);
    }
  });

  it('attack strike frame adds accent highlight pixels', () => {
    const base = MONSTER_SPRITES.paper_wraith;
    const plain = deriveFrames(base, 'attack')[0].rows.join('');
    const strike = deriveFrames(base, 'attack')[1].rows.join('');
    const count = (s: string): number => Array.from(s).filter((c) => c === '6').length;
    expect(count(strike)).toBeGreaterThan(count(plain));
  });

  it('death erodes progressively', () => {
    const base = MONSTER_SPRITES.memory_eater;
    const counts = deriveFrames(base, 'death').map(pixels);
    expect(counts[0]).toBeLessThan(pixels(base));
    expect(counts[1]).toBeLessThan(counts[0]);
    expect(counts[2]).toBeLessThan(counts[1]);
    expect(counts[2]).toBeGreaterThan(0);
  });

  it('is deterministic and builds animation keys', () => {
    const base = MONSTER_SPRITES.exam_warden;
    expect(deriveFrames(base, 'death')).toEqual(deriveFrames(base, 'death'));
    expect(animKey('exam_warden', 'hit')).toBe('exam_warden:hit');
  });
});
