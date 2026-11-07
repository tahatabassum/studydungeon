import type { RoomTheme } from '@/game/world/roomTheme'
import { drawClockworkCrypt } from './clockworkCrypt'
import { drawFloor } from './floor'
import { drawWalls, type WallOptions } from './walls'

export interface RoomDrawOptions extends WallOptions {
  seed: number
}

/** Draws one whole room (1280x800) into a 2D context: floor, walls, then theme dressing. */
export function drawRoom(ctx: CanvasRenderingContext2D, theme: RoomTheme, opts: RoomDrawOptions): void {
  drawFloor(ctx, theme.palette, opts.seed)
  drawWalls(ctx, theme.palette, opts, opts.seed + 1)
  if (theme.id === 'clockwork_crypt') drawClockworkCrypt(ctx, theme.palette, opts.seed)
}

export { createRng, hashString } from './rng'
