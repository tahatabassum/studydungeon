import type { PixelMap } from '../pixelMap';
import { artSym } from './build';

/**
 * Original small decorative characters for the landing page and overlays.
 * They never appear inside the game arena (Req 14.6).
 */

/** Friendly ghost, 16x16. */
export const friendly_ghost: PixelMap = artSym(
  'friendly_ghost',
  { B: 'bone', S: 'boneShadow', K: 'shadow' },
  [
    '........',
    '.....SBB',
    '...SBBBB',
    '..SBBBBB',
    '..BBBBBB',
    '..BBKKBB',
    '..BBKKBB',
    '..BBBBBB',
    '..BBBBBK',
    '..BBBBBB',
    '.SBBBBBB',
    '.SBBBBBB',
    '.BBBBBBB',
    '.BBBBBBB',
    '.BB.BBB.',
    '.S..S...',
  ],
);

/** Small vampire with cape and fangs, 16x16. */
export const small_vampire: PixelMap = artSym(
  'small_vampire',
  {
    K: 'shadow',
    f: 'skin',
    e: 'danger',
    w: 'bone',
    c: 'dangerDark',
    r: 'danger',
  },
  [
    '........',
    '....KKKK',
    '...KKKKK',
    '..KKKKKK',
    '..KKffff',
    '..Kfefff',
    '..Kfffff',
    '..Kffwff',
    '...fffff',
    '.ccrrfff',
    'ccrrrrww',
    'ccrrrrrw',
    'ccrrrrrr',
    'ccrrrrrr',
    'cc.KKK..',
    'c..KKK..',
  ],
);

/** Skeleton companion, 16x16. */
export const skeleton_companion: PixelMap = artSym(
  'skeleton_companion',
  { B: 'bone', S: 'boneShadow', K: 'shadow' },
  [
    '........',
    '....SBBB',
    '..SBBBBB',
    '..BBBBBB',
    '..BKKBBB',
    '..BKKBBK',
    '..SBBBBB',
    '...BSBSB',
    '......SB',
    '..BBBBBB',
    '..B.BBBB',
    '..BBBBBB',
    '..B.BBBB',
    '.....BBB',
    '...BB...',
    '..BBB...',
  ],
);

/** Bat with spread wings, 16x12. */
export const bat: PixelMap = artSym(
  'bat',
  { M: 'magicDark', D: 'deep', m: 'magic', e: 'danger', w: 'bone' },
  [
    '........',
    '........',
    '......M.',
    '....MMMM',
    '....MeMM',
    'D...MMMM',
    'DD..MwMM',
    'mDDDMMMM',
    'mmDDDMMM',
    'm.mDDDMM',
    '...mmD.M',
    '......MM',
  ],
);

/** Black cat with glowing eyes, 16x16. */
export const black_cat: PixelMap = artSym(
  'black_cat',
  { D: 'stoneDark', L: 'stone', e: 'accent', p: 'dangerLight' },
  [
    '........',
    '........',
    '....D...',
    '....DD..',
    '....DDDD',
    '....DDDD',
    '....DeDD',
    '....DDDp',
    '....DDDD',
    '...DDDDD',
    '..DDDLDD',
    '..DDDDDD',
    '..DDDDDD',
    '..DDDDDD',
    '..DDDDDD',
    '..LL....',
  ],
);

/** Haunted portrait: wooden frame with a ghostly figure, 16x19. */
export const haunted_portrait: PixelMap = artSym(
  'haunted_portrait',
  {
    W: 'wood',
    G: 'gold',
    d: 'deep',
    b: 'bone',
    S: 'boneShadow',
    K: 'shadow',
  },
  [
    'WWWWWWWW',
    'WGGGGGGG',
    'WGdddddd',
    'WGddddbb',
    'WGdddbbb',
    'WGdddbKb',
    'WGdddbbb',
    'WGddddbb',
    'WGdddbbb',
    'WGddbbbb',
    'WGdbbbbb',
    'WGdbbbbb',
    'WGdbbbbb',
    'WGdbbSbb',
    'WGdddddd',
    'WGdddddd',
    'WGGGGGGG',
    'WWWWWWWW',
    '.....GGG',
  ],
);

/** All characters by name. */
export const CHARACTER_SPRITES: Readonly<Record<string, PixelMap>> = {
  friendly_ghost,
  small_vampire,
  skeleton_companion,
  bat,
  black_cat,
  haunted_portrait,
};
