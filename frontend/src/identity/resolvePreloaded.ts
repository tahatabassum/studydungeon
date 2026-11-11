import { withFloors } from '../api/floorMapping' // pure helper, no network
import { capabilityOf, type ApiClient } from '../api/ApiClient'
import type { DemoSessionResponse, Dungeon, DungeonSummary, Pack, PacksResponse } from '../types/api'

/** D9/D31 read only these fields of a pack; the full Pack type satisfies it. */
export type PackInput = Pick<Pack, 'id' | 'order' | 'dungeon_id' | 'floors_cleared' | 'points_earned'> & {
  status: Pack['status'] | (string & {})
}

export interface PacksInput {
  packs: PackInput[]
  next_pack_id?: PacksResponse['next_pack_id']
}

export interface PreloadedPick {
  source: 'pack' | 'dungeon'
  dungeonId: string
  packId?: string
  /** Present for a pack pick; used by isFirstTime. */
  pack?: PackInput
}

/** D9: packs first (next pack, else first open, else order 1), then the oldest public demo. */
export function pickPreloaded(
  packs: PacksInput | null | undefined,
  dungeons: readonly DungeonSummary[] | null | undefined,
): PreloadedPick | null {
  const list = packs?.packs ?? []
  if (list.length > 0) {
    const byId = packs?.next_pack_id ? list.find((p) => p.id === packs.next_pack_id) : undefined
    const sorted = [...list].sort((a, b) => a.order - b.order)
    const open = sorted.find((p) => p.status === 'available' || p.status === 'in_progress')
    const first = sorted.find((p) => p.order === 1) ?? sorted[0]
    const pack = byId ?? open ?? first
    return { source: 'pack', dungeonId: pack.dungeon_id, packId: pack.id, pack }
  }
  const demos = (dungeons ?? []).filter((d) => d.is_public_demo)
  if (demos.length > 0) {
    const oldest = [...demos].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]
    return { source: 'dungeon', dungeonId: oldest.id }
  }
  return null
}

/**
 * D31: true only when Backend data shows nothing cleared. Missing or ambiguous data means "not first time".
 * A pack is first-time when available with 0 floors cleared and 0 points. A dungeon (detail) is first-time when
 * it has floors and none is cleared.
 */
export function isFirstTime(source: PackInput | Dungeon | null | undefined): boolean {
  if (!source) return false
  if ('rooms' in source) {
    const floors = withFloors(source).floors ?? []
    return floors.length > 0 && floors.every((f) => f.status !== 'cleared')
  }
  return source.status === 'available' && source.floors_cleared === 0 && source.points_earned === 0
}

/** D31: the first floor (by index) with status 'ready'; legacy dungeons map to their single floor. Null if none. */
export function firstPlayableFloorId(dungeon: Dungeon | null | undefined): string | null {
  if (!dungeon) return null
  const floors = [...(withFloors(dungeon).floors ?? [])].sort((a, b) => a.index - b.index)
  return floors.find((f) => f.status === 'ready')?.id ?? null
}

/** The route of a floor run. Same shape the floor map uses (`CampaignPage.playPath`); legacy dungeons use 'floor-legacy'. */
function floorRunPath(dungeonId: string, floorId: string): string {
  return `/campaign/${encodeURIComponent(dungeonId)}/play/${encodeURIComponent(floorId)}`
}

export interface ResolvedPreloaded {
  dungeonId: string
  /** Where the preloaded card goes: the first floor run for a first-time player, else the floor map. */
  path: string
  firstTime: boolean
  /** Set only when `POST /demo/session` was used (no session existed): the caller stores it in the SessionContext. */
  session?: DemoSessionResponse
}

export class NoPreloadedError extends Error {
  constructor() {
    super('The preloaded dungeons are not reachable right now.')
    this.name = 'NoPreloadedError'
  }
}

/**
 * D9 order: packs (when the packs capability is not off), then `GET /dungeons`, then `POST /demo/session`
 * ONLY when there is no session at all (that call replaces the cookie with a new anonymous Guest, Req 5.5).
 * D31: first-time is decided from Backend data only (the dungeon detail); unknown or any error opens the floor map.
 * Throws NoPreloadedError when nothing resolves.
 */
export async function resolvePreloadedDungeon(api: ApiClient, options: { hasSession: boolean }): Promise<ResolvedPreloaded> {
  // D9 step 1: packs, unless the capability is off. Any error falls through to the dungeon list.
  let packs: PacksInput | null = null
  if (capabilityOf(api, 'packs') !== 'off') {
    try {
      packs = await api.getPacks()
    } catch {
      packs = null
    }
  }

  // No session or an error: fall through to the next step.
  const dungeons: DungeonSummary[] = await api.listDungeons().catch(() => [])
  let pick = pickPreloaded(packs, dungeons)
  let session: DemoSessionResponse | undefined
  if (!pick && !options.hasSession) {
    try {
      session = await api.startDemoSession()
      pick = { source: 'dungeon', dungeonId: session.dungeon_id }
    } catch {
      throw new NoPreloadedError()
    }
  }
  if (!pick) throw new NoPreloadedError()

  const mapPath = `/campaign/${encodeURIComponent(pick.dungeonId)}`
  try {
    const dungeon = await api.getDungeon(pick.dungeonId)
    const floorId = firstPlayableFloorId(dungeon)
    const firstTime = isFirstTime(pick.pack ?? dungeon) && isFirstTime(dungeon)
    if (firstTime && floorId) return { dungeonId: pick.dungeonId, path: floorRunPath(pick.dungeonId, floorId), firstTime: true, session }
  } catch {
    // unknown progress: the floor map
  }
  return { dungeonId: pick.dungeonId, path: mapPath, firstTime: false, session }
}