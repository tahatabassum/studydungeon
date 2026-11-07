import type { PixelMap } from '../pixelMap';
import { artSym } from './build';

/** Hooded mage in a magic robe with gold and accent trim. 20x21 (mirrored). */
const playerIdle = artSym(
  'player_idle',
  {
    o: 'shadow',
    m: 'magic',
    c: 'magicDark',
    l: 'magicLight',
    u: 'skin',
    b: 'bg',
    g: 'gold',
    a: 'accent',
  },
  [
    '......oooo',
    '....oommmm',
    '...ommmmll',
    '..ommmmmmm',
    '..omcouuuu',
    '..omcuubuu',
    '..omcouuuu',
    '...omcouuu',
    '...ommoggg',
    '..ommmmgaa',
    '.ommmmmmmm',
    'ommmcmmmmm',
    'oummcmmmgm',
    'ommmcmmmaa',
    'ocmmmmmmmm',
    'ocmmmmmmmm',
    'ocmmmmmmcm',
    'ocmmmmmmmm',
    'oggggggggg',
    '.occcccccc',
    '..oooooooo',
  ],
);

/** Player base frames keyed by name. */
export const PLAYER_SPRITES: Record<string, PixelMap> = {
  player_idle: playerIdle,
};
