import { KEY } from '../palette';
import type { PixelMap } from '../pixelMap';

/**
 * Builds a PixelMap from mnemonic art. `legend` maps an art char to a palette
 * color name; '.' is always transparent. Shorter rows are padded with '.'.
 */
export function art(
  name: string,
  legend: Readonly<Record<string, keyof typeof KEY>>,
  rows: readonly string[],
): PixelMap {
  const width = Math.max(...rows.map((r) => r.length));
  const mapped = rows.map((r) =>
    Array.from(r.padEnd(width, '.'), (c) => {
      if (c === '.') return '.';
      const color = legend[c];
      if (!color) throw new Error(`${name}: unknown art char '${c}'`);
      return KEY[color];
    }).join(''),
  );
  return { name, width, height: rows.length, rows: mapped };
}

/** Like `art`, but rows describe the left half and are mirrored to the right. */
export function artSym(
  name: string,
  legend: Readonly<Record<string, keyof typeof KEY>>,
  halfRows: readonly string[],
): PixelMap {
  const w = Math.max(...halfRows.map((r) => r.length));
  return art(
    name,
    legend,
    halfRows.map((r) => {
      const h = r.padEnd(w, '.');
      return h + Array.from(h).reverse().join('');
    }),
  );
}
