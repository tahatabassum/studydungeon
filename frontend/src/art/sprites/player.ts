import type { PixelMap } from '../pixelMap';
import { deriveFrames } from '../frames';
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

/** Two-frame walking step derived from the idle sprite (padded +4x+2). */
const walkFrames = deriveFrames(playerIdle, 'walk');

/** Player base and walk frames keyed by name. */
export const PLAYER_SPRITES: Record<string, PixelMap> = {
  player_idle: playerIdle,
  ...Object.fromEntries(walkFrames.map((f) => [f.name, f])),
};
