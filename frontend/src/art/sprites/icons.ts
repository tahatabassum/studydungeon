import { KEY } from '../palette';
import type { PixelMap } from '../pixelMap';

/**
 * Original pixel-art icons. Rows are written with short legend letters, which
 * `build` translates into palette key chars. '.' is transparent.
 */
function build(
  name: string,
  legend: Readonly<Record<string, string>>,
  rows: readonly string[],
): PixelMap {
  const mapped = rows.map((row) =>
    Array.from(row, (ch) => (ch === '.' ? '.' : (legend[ch] ?? '?'))).join(''),
  );
  return { name, width: rows[0].length, height: rows.length, rows: mapped };
}

/** Heart, 16x16 (danger family). */
export const heart: PixelMap = build(
  'heart',
  { R: KEY.danger, L: KEY.dangerLight, D: KEY.dangerDark },
  [
    '................',
    '..DDDD....DDDD..',
    '.DRRRRD..DRRRRD.',
    'DRLLRRRDDRRRRRRD',
    'DRLRRRRRRRRRRRRD',
    'DRRRRRRRRRRRRRRD',
    'DRRRRRRRRRRRRRRD',
    '.DRRRRRRRRRRRRD.',
    '..DRRRRRRRRRRD..',
    '...DRRRRRRRRD...',
    '....DRRRRRRD....',
    '.....DRRRRD.....',
    '......DRRD......',
    '.......DD.......',
    '................',
    '................',
  ],
);

/** Crown, 16x16 (gold family with accent jewels). */
export const crown: PixelMap = build(
  'crown',
  { G: KEY.gold, D: KEY.goldDark, A: KEY.accent },
  [
    '................',
    '................',
    '..A....GG....A..',
    '..G...GGGG...G..',
    '..GG..GGGG..GG..',
    '..GGG.GGGG.GGG..',
    '..GGGGGGGGGGGG..',
    '..GGGAGGGGAGGG..',
    '..GGGGGGGGGGGG..',
    '..DDDDDDDDDDDD..',
    '..DGGGGGGGGGGD..',
    '..DDDDDDDDDDDD..',
    '................',
    '................',
    '................',
    '................',
  ],
);

/** Padlock, 12x12 (stone body, steel shackle). */
export const lock: PixelMap = build('lock', { S: KEY.stone, T: KEY.steel }, [
  '............',
  '...TTTTTT...',
  '..TT....TT..',
  '..T......T..',
  '..T......T..',
  '.SSSSSSSSSS.',
  '.SSSSSSSSSS.',
  '.SSSSTTSSSS.',
  '.SSSSTTSSSS.',
  '.SSSSTTSSSS.',
  '.SSSSSSSSSS.',
  '............',
]);

/** Check mark, 12x12 (health family). */
export const check: PixelMap = build('check', { H: KEY.health, D: KEY.healthDark }, [
  '............',
  '............',
  '..........HH',
  '.........HHD',
  '........HHD.',
  'H......HHD..',
  'HH....HHD...',
  '.HH..HHD....',
  '..HHHHD.....',
  '...HHD......',
  '....D.......',
  '............',
]);

/** Skull, 16x16 (bone with shadow sockets), for boss and defeat. */
export const skull: PixelMap = build(
  'skull',
  { B: KEY.bone, S: KEY.boneShadow, K: KEY.shadow },
  [
    '................',
    '....SBBBBBBS....',
    '..SBBBBBBBBBBS..',
    '..BBBBBBBBBBBB..',
    '.SBBBBBBBBBBBBS.',
    '.BBBKKKBBKKKBBB.',
    '.BBKKKKBBKKKKBB.',
    '.BBKKKKBBKKKKBB.',
    '.BBBKKBBBBKKBBB.',
    '.SBBBBBKKBBBBBS.',
    '..SBBBBKKBBBBS..',
    '...SBBBBBBBBS...',
    '....BSBSBSBS....',
    '....BSBSBSBS....',
    '....SSSSSSSS....',
    '................',
  ],
);

/** Star, 12x12 (gold), for XP. */
export const star: PixelMap = build('star', { G: KEY.gold }, [
  '............',
  '.....GG.....',
  '.....GG.....',
  '....GGGG....',
  'GGGGGGGGGGGG',
  '.GGGGGGGGGG.',
  '..GGGGGGGG..',
  '...GGGGGG...',
  '..GGGGGGGG..',
  '..GGG..GGG..',
  '.GG......GG.',
  '............',
]);

/** All icons by name. */
export const ICONS: Readonly<Record<string, PixelMap>> = {
  heart,
  crown,
  lock,
  check,
  skull,
  star,
};
