import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { PALETTE, PALETTE_KEYS } from './palette';
import {
  MAX_SPRITE_SIZE,
  pixelMapToRgba,
  pixelMapToRuns,
  validatePixelMap,
  type PixelMap,
} from './pixelMap';

// Feature: frontend-04-rpg-ui-combat-flow, Property 12: Pixel map validation and rendering
// **Validates: Requirements 14.1, 14.3, 14.4**

const VALID_CHARS = ['.', ...Object.keys(PALETTE_KEYS)];
const validChar = fc.constantFrom(...VALID_CHARS);
const invalidChar = fc.constantFrom('w', 'x', 'y', 'z', '#', '!');
const nameArb = fc.stringMatching(/^[a-z][a-z0-9_-]{2,12}$/);

const validMapArb: fc.Arbitrary<PixelMap> = fc
  .record({
    name: nameArb,
    width: fc.integer({ min: 1, max: MAX_SPRITE_SIZE }),
    height: fc.integer({ min: 1, max: MAX_SPRITE_SIZE }),
  })
  .chain(({ name, width, height }) =>
    fc
      .array(fc.string({ unit: validChar, minLength: width, maxLength: width }), {
        minLength: height,
        maxLength: height,
      })
      .map((rows) => ({ name, width, height, rows })),
  );

const NUM_RUNS = { numRuns: 100 };

function expectErrorsNamed(map: PixelMap): void {
  const errors = validatePixelMap(map);
  expect(errors.length).toBeGreaterThanOrEqual(1);
  for (const e of errors) expect(e).toContain(map.name);
}

describe('Feature: frontend-04-rpg-ui-combat-flow, Property 12: Pixel map validation and rendering', () => {
  it('valid maps validate cleanly and render to correct RGBA', () => {
    fc.assert(
      fc.property(validMapArb, (map) => {
        expect(validatePixelMap(map)).toEqual([]);
        const rgba = pixelMapToRgba(map);
        expect(rgba.length).toBe(map.width * map.height * 4);
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            const ch = map.rows[y][x];
            const o = (y * map.width + x) * 4;
            if (ch === '.' || ch === '0') {
              expect([rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]]).toEqual([0, 0, 0, 0]);
            } else {
              const hex = PALETTE[PALETTE_KEYS[ch]];
              const n = parseInt(hex.slice(1), 16);
              expect([rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]]).toEqual([
                (n >> 16) & 255,
                (n >> 8) & 255,
                n & 255,
                255,
              ]);
            }
          }
        }
      }),
      NUM_RUNS,
    );
  });

  it('runs cover exactly the opaque pixels, single color, maximally merged', () => {
    fc.assert(
      fc.property(validMapArb, (map) => {
        const runs = pixelMapToRuns(map);
        const seen = new Map<string, string>();
        for (const r of runs) {
          expect(r.length).toBeGreaterThanOrEqual(1);
          for (let i = 0; i < r.length; i++) {
            const key = `${r.x + i},${r.y}`;
            expect(seen.has(key)).toBe(false); // no overlap
            seen.set(key, r.color);
            const ch = map.rows[r.y][r.x + i];
            expect(ch).not.toBe('.');
            expect(ch).not.toBe('0');
            expect(PALETTE[PALETTE_KEYS[ch]]).toBe(r.color); // single color
          }
        }
        let opaque = 0;
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            const ch = map.rows[y][x];
            if (ch !== '.' && ch !== '0') {
              opaque++;
              expect(seen.has(`${x},${y}`)).toBe(true); // no gaps
            }
          }
        }
        expect(seen.size).toBe(opaque);
        // maximal merge: adjacent runs in same row never share a color
        for (let i = 1; i < runs.length; i++) {
          const a = runs[i - 1];
          const b = runs[i];
          if (a.y === b.y && a.x + a.length === b.x) expect(a.color).not.toBe(b.color);
        }
      }),
      NUM_RUNS,
    );
  });

  it('(a) a row with wrong length yields errors naming the sprite', () => {
    fc.assert(
      fc.property(
        validMapArb,
        fc.nat(),
        fc.boolean(),
        fc.integer({ min: 1, max: 5 }),
        fc.array(validChar, { minLength: 5, maxLength: 5 }),
        (map, rowSeed, lengthen, delta, extra) => {
          const y = rowSeed % map.height;
          const row = map.rows[y];
          const bad = lengthen
            ? row + extra.slice(0, delta).join('')
            : row.slice(0, Math.max(0, row.length - delta));
          const rows = map.rows.map((r, i) => (i === y ? bad : r));
          expectErrorsNamed({ ...map, rows });
        },
      ),
      NUM_RUNS,
    );
  });

  it('(b) an invalid pixel char yields errors naming the sprite', () => {
    fc.assert(
      fc.property(validMapArb, fc.nat(), fc.nat(), invalidChar, (map, ys, xs, ch) => {
        const y = ys % map.height;
        const x = xs % map.width;
        const row = map.rows[y];
        const rows = map.rows.map((r, i) => (i === y ? row.slice(0, x) + ch + row.slice(x + 1) : r));
        expectErrorsNamed({ ...map, rows });
      }),
      NUM_RUNS,
    );
  });

  it('(c) rows.length != height yields errors naming the sprite', () => {
    fc.assert(
      fc.property(
        validMapArb,
        fc.integer({ min: 1, max: MAX_SPRITE_SIZE }),
        (map, h) => {
          fc.pre(h !== map.height);
          expectErrorsNamed({ ...map, height: h });
        },
      ),
      NUM_RUNS,
    );
  });

  it('(d) width 0 or > 32 without allowLarge yields errors naming the sprite', () => {
    fc.assert(
      fc.property(
        validMapArb,
        fc.oneof(fc.constant(0), fc.integer({ min: MAX_SPRITE_SIZE + 1, max: 100 })),
        (map, w) => {
          expectErrorsNamed({ ...map, width: w });
        },
      ),
      NUM_RUNS,
    );
  });
});
