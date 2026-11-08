import { GATE, MONSTER_SPAWN, PILLARS, PLAYER_SPAWN, TILE, WORLD_H, type Rect } from './RoomLayout'

/** Half width of the walkable corridor between spawn, monster and gate. */
const CORRIDOR_HALF = 96
const MONSTER_RADIUS = 96
const SPAWN_RADIUS = 64
const GATE_APPROACH = 128

/**
 * Keep_Out_Zone as bounding rects (room-local coordinates): the corridor from spawn to gate,
 * the monster and spawn clearance, and the gate approach. Pure.
 */
export function keepOutZone(): Rect[] {
  const cx = GATE.x + GATE.w / 2
  return [
    { x: cx - CORRIDOR_HALF, y: TILE, w: CORRIDOR_HALF * 2, h: WORLD_H - 2 * TILE },
    {
      x: MONSTER_SPAWN.x - MONSTER_RADIUS,
      y: MONSTER_SPAWN.y - MONSTER_RADIUS,
      w: MONSTER_RADIUS * 2,
      h: MONSTER_RADIUS * 2,
    },
    {
      x: PLAYER_SPAWN.x - SPAWN_RADIUS,
      y: PLAYER_SPAWN.y - SPAWN_RADIUS,
      w: SPAWN_RADIUS * 2,
      h: SPAWN_RADIUS * 2,
    },
    { x: cx - CORRIDOR_HALF, y: TILE, w: CORRIDOR_HALF * 2, h: GATE_APPROACH },
  ]
}

/** Keep-out rects plus the pillars; the default blocked list for the Prop_Placer. */
export function propBlockers(): Rect[] {
  return [...keepOutZone(), ...PILLARS]
}
