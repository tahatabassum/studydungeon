import { KEY } from './palette';
import type { PixelMap } from './pixelMap';

/** Animation kinds derived programmatically from a base sprite. */
export type FrameKind = 'idle' | 'attack' | 'hit' | 'death' | 'walk';

/** Padding added around the base so offsets never clip (width +4, height +2). */
export const PAD_X = 2;
export const PAD_Y = 1;

/** Name of derived frame `index` of `kind` for a base sprite. */
export function frameName(baseName: string, kind: FrameKind, index: number): string {
  return `${baseName}_${kind}_${index}`;
}

/** Animation key for a base sprite and kind. */
export function animKey(baseName: string, kind: FrameKind): string {
  return `${baseName}:${kind}`;
}

type Remap = (ch: string, x: number, y: number) => string;

/**
 * Places the base onto a padded canvas with a per-row horizontal offset and a
 * vertical offset. `remap` may recolor a pixel; `keep` may drop a pixel.
 */
function place(
  base: PixelMap,
  name: string,
  dxOf: (y: number) => number,
  dy: number,
  remap?: Remap,
  keep?: (x: number, y: number) => boolean,
): PixelMap {
  const width = base.width + PAD_X * 2;
  const height = base.height + PAD_Y * 2;
  const grid: string[][] = Array.from({ length: height }, () => new Array<string>(width).fill('.'));
  for (let y = 0; y < base.height; y++) {
    const row = base.rows[y] ?? '';
    for (let x = 0; x < base.width; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      if (keep && !keep(x, y)) continue;
      const gx = x + PAD_X + dxOf(y);
      const gy = y + PAD_Y + dy;
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
      grid[gy][gx] = remap ? remap(ch, x, y) : ch;
    }
  }
  return { name, width, height, rows: grid.map((r) => r.join('')) };
}

/** Deterministic 0..9 value per pixel; used to erode sprites. */
function erosionHash(x: number, y: number): number {
  return (x * 7 + y * 13 + ((x * y) % 5) * 3) % 10;
}

const DEATH_THRESHOLDS = [3, 6, 9] as const;
const DEATH_DY = [0, 1, 1] as const;

/**
 * Derives animation frames from a base sprite. Every frame is
 * (width + 4) x (height + 2), so frames of a base are interchangeable.
 * - idle: base, then base bobbed up by 1px (2 frames)
 * - attack: wind-up, strike lean with accent highlight on top edges, recover (3)
 * - hit: bright white flash, then light red flash (2)
 * - death: progressive erosion, 3 frames
 * - walk: legs alternate sideways with a 1px body bob (2)
 */
export function deriveFrames(base: PixelMap, kind: FrameKind): PixelMap[] {
  const n = (i: number): string => frameName(base.name, kind, i);
  const zero = (): number => 0;
  switch (kind) {
    case 'idle':
      return [place(base, n(0), zero, 0), place(base, n(1), zero, -1)];
    case 'attack': {
      const topEdge: Remap = (ch, x, y) =>
        y === 0 || base.rows[y - 1]?.[x] === '.' ? KEY.accent : ch;
      return [
        place(base, n(0), () => -1, 0),
        place(base, n(1), () => 2, 0, topEdge),
        place(base, n(2), () => 1, 0),
      ];
    }
    case 'hit':
      return [
        place(base, n(0), () => -1, 0, () => KEY.ink),
        place(base, n(1), () => 1, 0, () => KEY.dangerLight),
      ];
    case 'death':
      return DEATH_THRESHOLDS.map((thr, i) =>
        place(base, n(i), zero, DEATH_DY[i], undefined, (x, y) => erosionHash(x, y) >= thr),
      );
    case 'walk': {
      const legsFrom = base.height - 3;
      return [
        place(base, n(0), (y) => (y >= legsFrom ? -1 : 0), 0),
        place(base, n(1), (y) => (y >= legsFrom ? 1 : 0), -1),
      ];
    }
  }
}
