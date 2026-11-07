/**
 * Approved pixel-art palette (max 32 entries). Pure data, no framework imports.
 * Index 0 is transparent; every other entry is an opaque '#RRGGBB' string.
 */

/** Ordered palette entries with names; order defines palette indices. */
const ENTRIES = [
  ['clear', 'transparent'],
  // Approved design tokens
  ['bg', '#100B18'],
  ['surface2', '#1C1427'],
  ['panel', '#251A32'],
  ['deep', '#39244F'],
  ['magic', '#9B5DE5'],
  ['accent', '#FF9F1C'],
  ['ink', '#F5EBDD'],
  ['danger', '#C83E4D'],
  ['health', '#59C9A5'],
  ['gold', '#E9B44C'],
  ['inkMuted', '#B9AEC9'],
  // Extra shading colors for pixel art
  ['magicDark', '#6A3AB0'],
  ['magicLight', '#C39BF0'],
  ['accentDark', '#B36B0A'],
  ['dangerDark', '#8A2634'],
  ['dangerLight', '#E8707C'],
  ['healthDark', '#3A8F73'],
  ['healthLight', '#8FE3C6'],
  ['goldDark', '#A67C22'],
  ['bone', '#D9CFB8'],
  ['boneShadow', '#A69C86'],
  ['stoneLight', '#7A7388'],
  ['stone', '#5A5468'],
  ['stoneDark', '#3C3749'],
  ['slime', '#6FBF3F'],
  ['slimeDark', '#3F8A2A'],
  ['steel', '#A8B4C4'],
  ['steelDark', '#6E7A8C'],
  ['shadow', '#07050C'],
  ['skin', '#E0AC87'],
  ['wood', '#7A4B2A'],
] as const;

/** Palette colors by index. Index 0 = transparent (the string 'transparent'). */
export const PALETTE: readonly string[] = ENTRIES.map((e) => e[1]);

/** Single-character pixel keys, in palette index order ('0'-'9','a'-'v'). */
const KEY_CHARS = '0123456789abcdefghijklmnopqrstuv';

/** Maps a pixel key character to its palette index. */
export const PALETTE_KEYS: Readonly<Record<string, number>> = Object.fromEntries(
  Array.from(KEY_CHARS.slice(0, ENTRIES.length), (c, i) => [c, i]),
);

type Name = (typeof ENTRIES)[number][0];

/** Named lookup: palette index by color name, e.g. `PAL.ink`. */
export const PAL = Object.fromEntries(ENTRIES.map((e, i) => [e[0], i])) as Readonly<
  Record<Name, number>
>;

/** Named lookup: pixel key character by color name, e.g. `KEY.ink`. */
export const KEY = Object.fromEntries(
  ENTRIES.map((e, i) => [e[0], KEY_CHARS[i]]),
) as Readonly<Record<Name, string>>;
