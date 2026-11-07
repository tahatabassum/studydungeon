import { PALETTE, PALETTE_KEYS } from './palette';

/** Character used for a transparent pixel. */
const TRANSPARENT = '.';

/** Maximum sprite dimension in pixels (design: sprites are 16-32px). */
export const MAX_SPRITE_SIZE = 32;
/** Absolute maximum dimension, only allowed with `allowLarge` (decor). */
export const MAX_LARGE_SIZE = 64;

/**
 * A sprite as text. One char per pixel: '.' transparent, otherwise a key from
 * PALETTE_KEYS.
 */
export interface PixelMap {
  name: string;
  width: number;
  height: number;
  rows: readonly string[];
}

/** A horizontal run of same-colored pixels. */
export interface Run {
  x: number;
  y: number;
  length: number;
  color: string;
}

/** Palette index for a pixel char; 0 for '.', -1 if invalid. */
function indexOf(ch: string): number {
  if (ch === TRANSPARENT) return 0;
  const i = PALETTE_KEYS[ch];
  return i === undefined || i >= PALETTE.length ? -1 : i;
}

/**
 * Validates a pixel map. Returns error strings (each containing the sprite
 * name); empty when valid. Dimensions must be 1..32, or 1..64 when
 * `allowLarge` is true.
 */
export function validatePixelMap(map: PixelMap, allowLarge = false): string[] {
  const errors: string[] = [];
  const max = allowLarge ? MAX_LARGE_SIZE : MAX_SPRITE_SIZE;
  const { name, width, height, rows } = map;
  const dimOk = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= max;
  if (!dimOk(width)) errors.push(`${name}: width ${width} outside 1..${max}`);
  if (!dimOk(height)) errors.push(`${name}: height ${height} outside 1..${max}`);
  if (rows.length !== height) {
    errors.push(`${name}: rows.length ${rows.length} !== height ${height}`);
  }
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row.length !== width) {
      errors.push(`${name}: row ${y} length ${row.length} !== width ${width}`);
    }
    for (let x = 0; x < row.length; x++) {
      if (indexOf(row[x]) < 0) {
        errors.push(`${name}: invalid char '${row[x]}' at (${x},${y})`);
      }
    }
  }
  return errors;
}

/** Parses '#RRGGBB' into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Converts a (valid) map to RGBA bytes, width*height*4. Transparent or
 * unknown pixels are 0,0,0,0; others are opaque.
 */
export function pixelMapToRgba(map: PixelMap): Uint8ClampedArray {
  const { width, height, rows } = map;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < width; x++) {
      const idx = indexOf(row[x] ?? TRANSPARENT);
      if (idx <= 0) continue;
      const [r, g, b] = hexToRgb(PALETTE[idx]);
      const o = (y * width + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Merges horizontally adjacent same-color pixels into runs, row by row.
 * Transparent pixels are skipped.
 */
export function pixelMapToRuns(map: PixelMap): Run[] {
  const runs: Run[] = [];
  const { width, height, rows } = map;
  for (let y = 0; y < height; y++) {
    const row = rows[y] ?? '';
    let x = 0;
    while (x < width) {
      const idx = indexOf(row[x] ?? TRANSPARENT);
      if (idx <= 0) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < width && indexOf(row[end] ?? TRANSPARENT) === idx) end++;
      runs.push({ x, y, length: end - x, color: PALETTE[idx] });
      x = end;
    }
  }
  return runs;
}
