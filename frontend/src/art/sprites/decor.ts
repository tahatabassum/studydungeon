import { KEY } from '../palette';
import type { PixelMap } from '../pixelMap';
import { art, artSym } from './build';

type ColorName = keyof typeof KEY;

/**
 * Builds a sprite from a per-pixel picker (for round or radial shapes).
 * (cx, cy) is the reference point; `pick` receives offsets from it. With
 * `outline`, empty pixels touching a colored pixel become shadow.
 */
function raster(
  name: string,
  width: number,
  height: number,
  cx: number,
  cy: number,
  pick: (dx: number, dy: number, r: number, angle: number) => ColorName | null,
  outline: boolean,
): PixelMap {
  const cells: (ColorName | null)[][] = [];
  for (let y = 0; y < height; y++) {
    const row: (ColorName | null)[] = [];
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      row.push(pick(dx, dy, Math.hypot(dx, dy), Math.atan2(dy, dx)));
    }
    cells.push(row);
  }
  const rows = cells.map((row, y) =>
    row
      .map((cell, x) => {
        if (cell) return KEY[cell];
        const near =
          cells[y - 1]?.[x] || cells[y + 1]?.[x] || cells[y]?.[x - 1] || cells[y]?.[x + 1];
        return outline && near ? KEY.shadow : '.';
      })
      .join(''),
  );
  return { name, width, height, rows };
}

/** Bookshelf with colorful books. 16x16. */
const bookshelf = art(
  'decor_bookshelf',
  { o: 'shadow', w: 'wood', m: 'magic', d: 'danger', g: 'gold', h: 'health' },
  [
    'oooooooooooooooo',
    'owwwwwwwwwwwwwwo',
    'ommdgmhhdmmgdmmo',
    'ommdgmhhdmmgdmmo',
    'ommdgmhhdmmgdmmo',
    'owwwwwwwwwwwwwwo',
    'ohhgdmmgdhhmgddo',
    'ohhgdmmgdhhmgddo',
    'ohhgdmmgdhhmgddo',
    'owwwwwwwwwwwwwwo',
    'odmgmhdgmmdhgmdo',
    'odmgmhdgmmdhgmdo',
    'odmgmhdgmmdhgmdo',
    'owwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwo',
    'oooooooooooooooo',
  ],
);

/** Candle with a small flame. 8x12. */
const candle = art(
  'decor_candle',
  { o: 'shadow', a: 'accent', g: 'gold', k: 'bone', j: 'goldDark' },
  [
    '...aa...',
    '..agga..',
    '..agga..',
    '...gg...',
    '...oo...',
    '..okko..',
    '..okko..',
    '..okko..',
    '..okko..',
    '.oooooo.',
    'ojjjjjjo',
    '.oooooo.',
  ],
);

/** Cobweb for a top-left corner. 12x12. */
const cobweb = raster(
  'decor_cobweb',
  12,
  12,
  0,
  0,
  (dx, dy, r) => {
    const spoke = dx === 0 || dy === 0 || dx === dy || dx * 2 === dy || dy * 2 === dx;
    if (r >= 12) return null;
    if (spoke) return 'stoneLight';
    if ((r >= 4 && r < 4.9) || (r >= 8 && r < 8.9)) return 'inkMuted';
    return null;
  },
  false,
);

/** Bubbling cauldron. 16x14. */
const cauldron = art(
  'decor_cauldron',
  { o: 'shadow', u: 'stone', p: 'slime', h: 'healthLight', d: 'stoneDark', l: 'stoneLight' },
  [
    '..oooooooooooo..',
    '.ouuuuuuuuuuuuo.',
    '.oppphpppppphpo.',
    'ouuuuuuuuuuuuuuo',
    'odlddddddddddddo',
    'odlddddddddddddo',
    'oddddddddddddddo',
    '.oddddddddddddo.',
    '.oddddddddddddo.',
    '..oddddddddddo..',
    '..oooooooooooo..',
    '..ooo......ooo..',
    '..ouo......ouo..',
    '..ooo......ooo..',
  ],
);

/** Potion bottle with magic liquid. 8x11. */
const potion = art(
  'decor_potion',
  { o: 'shadow', w: 'wood', y: 'steel', m: 'magic', h: 'magicLight', c: 'magicDark' },
  [
    '..oooo..',
    '..owwo..',
    '..oyyo..',
    '.ooyyoo.',
    'oyymmyyo',
    'oymmmmyo',
    'oymhmmyo',
    'oymmmmyo',
    'oymmmcyo',
    '.oyccyo.',
    '..oooo..',
  ],
);

/** Gear with 8 teeth. 16x16. */
const gear = raster(
  'decor_gear',
  16,
  16,
  7.5,
  7.5,
  (dx, dy, r, angle) => {
    if (r < 1.8) return null;
    if (r < 5.2) return r >= 4 && dx + dy < 0 ? 'steel' : 'steelDark';
    const tooth = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 16) % 2 === 0;
    return r < 6.6 && tooth ? 'steelDark' : null;
  },
  true,
);

/** Hanging chain. 8x16. */
const chain = art(
  'decor_chain',
  { o: 'shadow', s: 'steelDark', l: 'steel' },
  [
    '..oooo..',
    '.osllso.',
    '.os..so.',
    '.osllso.',
    '..oooo..',
    '...oo...',
    '...ss...',
    '...ss...',
    '...oo...',
    '..oooo..',
    '.osllso.',
    '.os..so.',
    '.osllso.',
    '..oooo..',
    '...oo...',
    '...ss...',
  ],
);

/** Gravestone with an engraved cross. 16x17 (mirrored). */
const tomb = artSym(
  'decor_tomb',
  { o: 'shadow', u: 'stoneLight', l: 'stone', d: 'stoneDark', s: 'stoneDark' },
  [
    '.....ooo',
    '...ooull',
    '..oullll',
    '.oulllll',
    '.oulllll',
    '.oulllld',
    '.oulllld',
    '.oullddd',
    '.oulllld',
    '.oulllld',
    '.oulllld',
    '.oulllls',
    '.oulllls',
    '.oulllls',
    'ooouuuuu',
    'osssssss',
    'oooooooo',
  ],
);

/** Glowing floor rune. 16x16. */
const rune = raster(
  'decor_rune',
  16,
  16,
  7.5,
  7.5,
  (dx, dy, r) => {
    if (r >= 5 && r < 6.4) return 'magic';
    const bar = (Math.abs(dx) < 0.8 && Math.abs(dy) < 4) || (Math.abs(dy) < 0.8 && Math.abs(dx) < 4);
    if (bar) return 'magicLight';
    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.7 && r > 2.2 && r < 4.2) return 'magic';
    return null;
  },
  false,
);

/** Stone column. 12x22 (mirrored). */
const column = artSym(
  'decor_column',
  { o: 'shadow', u: 'stoneLight', l: 'stone', s: 'stoneDark' },
  [
    'oooooo',
    'ouuuuu',
    'osllll',
    'oooooo',
    ...Array.from({ length: 14 }, () => '.oulls'),
    'oooooo',
    'osllll',
    'ouuuuu',
    'osssss',
  ],
);

/** Decor sprites keyed by name (each at most 16x22). */
export const DECOR_SPRITES: Record<string, PixelMap> = {
  decor_bookshelf: bookshelf,
  decor_candle: candle,
  decor_cobweb: cobweb,
  decor_cauldron: cauldron,
  decor_potion: potion,
  decor_gear: gear,
  decor_chain: chain,
  decor_tomb: tomb,
  decor_rune: rune,
  decor_column: column,
};
