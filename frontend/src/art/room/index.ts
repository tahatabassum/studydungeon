import type { RoomTheme } from '@/game/world/roomTheme'
import { drawBossHall } from './bossHall'
import { drawClockworkCrypt } from './clockworkCrypt'
import { drawLibrary } from './library'
import { drawPumpkinWorkshop } from './pumpkinWorkshop'
import { drawWitchLab } from './witchLab'
import { drawFloor } from './floor'
import { drawWalls, type WallOptions } from './walls'

export interface RoomDrawOptions extends WallOptions {
  seed: number
}

/** Draws one whole room (1280x800) into a 2D context: floor, walls, then theme dressing. */
export function drawRoom(ctx: CanvasRenderingContext2D, theme: RoomTheme, opts: RoomDrawOptions): void {
  drawFloor(ctx, theme.palette, opts.seed)
  drawWalls(ctx, theme.palette, opts, opts.seed + 1)
  switch (theme.id) {
    case 'clockwork_crypt':
      drawClockworkCrypt(ctx, theme.palette, opts.seed)
      break
    case 'library':
      drawLibrary(ctx, theme.palette, opts.seed)
      break
    case 'witch_lab':
      drawWitchLab(ctx, theme.palette, opts.seed)
      break
    case 'pumpkin_workshop':
      drawPumpkinWorkshop(ctx, theme.palette, opts.seed)
      break
    case 'boss_hall':
      drawBossHall(ctx, theme.palette, opts.seed)
      break
    default:
      break
  }
}

export { createRng, hashString } from './rng'
