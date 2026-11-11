import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { firstPlayableFloorId, isFirstTime, pickPreloaded, type PackInput, type PacksInput } from './resolvePreloaded'
import type { Dungeon, DungeonSummary, Floor } from '../types/api'

// Feature: frontend-10-live-players, Property 4: Preloaded dungeon choice is deterministic and valid
// **Validates: Requirements 5.4**

const STATUSES = ['locked', 'available', 'in_progress', 'completed'] as const
const isOpen = (p: PackInput) => p.status === 'available' || p.status === 'in_progress'

/** Unique ids, unique orders (a permutation of 1..n), arbitrary statuses, plus a next_pack_id that exists, is null, or is missing. */
const packsArb: fc.Arbitrary<PacksInput> = fc
  .integer({ min: 1, max: 8 })
  .chain((n) =>
    fc.record({
      statuses: fc.array(fc.constantFrom(...STATUSES), { minLength: n, maxLength: n }),
      cleared: fc.array(fc.nat(5), { minLength: n, maxLength: n }),
      points: fc.array(fc.nat(500), { minLength: n, maxLength: n }),
      orders: fc.shuffledSubarray(Array.from({ length: n }, (_, i) => i + 1), { minLength: n, maxLength: n }),
      next: fc.oneof(fc.constant<'null'>('null'), fc.constant<'missing'>('missing'), fc.nat(n - 1)),
    }),
  )
  .map(({ statuses, cleared, points, orders, next }) => {
    const packs: PackInput[] = statuses.map((status, i) => ({
      id: `p${i}`,
      order: orders[i],
      dungeon_id: `d${i}`,
      status,
      floors_cleared: cleared[i],
      points_earned: points[i],
    }))
    const next_pack_id = next === 'null' ? null : next === 'missing' ? 'p-missing' : `p${next}`
    return { packs, next_pack_id }
  })

const isoArb = fc
  .date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z'), noInvalidDate: true })
  .map((d) => d.toISOString())

/** Unique ids, unique created_at so "oldest" is unambiguous. */
const dungeonsArb: fc.Arbitrary<DungeonSummary[]> = fc
  .uniqueArray(fc.tuple(isoArb, fc.boolean()), { selector: (t) => t[0], minLength: 0, maxLength: 8 })
  .map((rows) =>
    rows.map(([created_at, is_public_demo], i) => ({ id: `s${i}`, title: `s${i}`, is_public_demo, created_at, rooms_count: 3 })),
  )

const shuffled = <T,>(xs: readonly T[], seed: number[]): T[] => {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = seed[i % Math.max(seed.length, 1)] % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const seedArb = fc.array(fc.nat(1000), { minLength: 1, maxLength: 8 })

/** D9 reference: next_pack_id if in list, else open pack with the lowest order, else order-1 pack. */
const expectedPack = (input: PacksInput): PackInput => {
  const list = input.packs
  const byId = input.next_pack_id ? list.find((p) => p.id === input.next_pack_id) : undefined
  if (byId) return byId
  const byOrder = [...list].sort((a, b) => a.order - b.order)
  return byOrder.find(isOpen) ?? byOrder[0]
}

describe('Feature: frontend-10-live-players, Property 4: Preloaded dungeon choice is deterministic and valid', () => {
  const opts = { numRuns: 150 }

  it('is deterministic and independent of pack/dungeon input order', () => {
    fc.assert(
      fc.property(packsArb, dungeonsArb, seedArb, (packs, dungeons, seed) => {
        const a = pickPreloaded(packs, dungeons)
        const b = pickPreloaded(packs, dungeons)
        if (JSON.stringify(a) !== JSON.stringify(b)) return false
        const c = pickPreloaded({ ...packs, packs: shuffled(packs.packs, seed) }, shuffled(dungeons, seed))
        return JSON.stringify(a) === JSON.stringify(c)
      }),
      opts,
    )
  })

  it('with packs, picks a pack in the list following D9 precedence', () => {
    fc.assert(
      fc.property(packsArb, dungeonsArb, (packs, dungeons) => {
        const r = pickPreloaded(packs, dungeons)
        if (!r || r.source !== 'pack') return false
        const exp = expectedPack(packs)
        const member = packs.packs.some((p) => p.dungeon_id === r.dungeonId && p.id === r.packId)
        return member && r.packId === exp.id && r.dungeonId === exp.dungeon_id && r.pack === exp
      }),
      opts,
    )
  })

  it('never picks a locked pack unless it is next_pack_id or nothing is open', () => {
    fc.assert(
      fc.property(packsArb, (packs) => {
        const r = pickPreloaded(packs, [])
        const picked = packs.packs.find((p) => p.id === r?.packId)
        if (!picked || picked.status !== 'locked') return true
        const viaNext = packs.next_pack_id === picked.id
        const noneOpen = !packs.packs.some(isOpen)
        return viaNext || noneOpen
      }),
      opts,
    )
  })

  it('with only dungeons, picks the oldest public demo; null only when no source is valid', () => {
    fc.assert(
      fc.property(
        dungeonsArb,
        fc.constantFrom<PacksInput | null | undefined>(null, undefined, { packs: [] }, { packs: [], next_pack_id: 'x' }),
        (dungeons, packs) => {
          const r = pickPreloaded(packs, dungeons)
          const demos = dungeons.filter((d) => d.is_public_demo)
          if (demos.length === 0) return r === null
          const oldest = [...demos].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]
          return r?.source === 'dungeon' && r.dungeonId === oldest.id && r.packId === undefined
        },
      ),
      opts,
    )
  })

  it('result is null only when there are no packs and no public demo', () => {
    fc.assert(
      fc.property(fc.option(packsArb, { nil: null }), dungeonsArb, (packs, dungeons) => {
        const r = pickPreloaded(packs, dungeons)
        const hasSource = (packs?.packs.length ?? 0) > 0 || dungeons.some((d) => d.is_public_demo)
        return (r === null) === !hasSource
      }),
      opts,
    )
  })

  it('isFirstTime is false for missing/unknown data and for any pack that is not a fresh available one', () => {
    fc.assert(
      fc.property(packsArb, fc.string(), (packs, unknownStatus) => {
        if (isFirstTime(null) || isFirstTime(undefined)) return false
        for (const p of packs.packs) {
          const expected = p.status === 'available' && p.floors_cleared === 0 && p.points_earned === 0
          if (isFirstTime(p) !== expected) return false
        }
        const base = packs.packs[0]
        const known = (STATUSES as readonly string[]).includes(unknownStatus)
        return known || !isFirstTime({ ...base, status: unknownStatus, floors_cleared: 0, points_earned: 0 })
      }),
      opts,
    )
  })

  const floorStatusArb = fc.constantFrom<Floor['status']>('locked', 'ready', 'cleared')
  const mkFloor = (id: string, index: number, status: Floor['status']): Floor => ({
    id, index, title: id, status, topics: [], boss: { id: 'b', name: 'B', hp: 1 }, rank: null, room_ids: [],
  })
  const rooms: Dungeon['rooms'] = [
    { id: 'r1', label: 'R', order: 1, is_boss: true, monster: { id: 'm', name: 'M', max_hp: 5, question_ids: [], kind: 'x' } },
  ]
  const dungeonArb: fc.Arbitrary<Dungeon> = fc.oneof(
    fc.constant<Dungeon>({ id: 'legacy', name: 'L', questions: [], rooms }),
    fc
      .array(floorStatusArb, { minLength: 1, maxLength: 6 })
      .chain((sts) => fc.shuffledSubarray(sts.map((_, i) => i + 1), { minLength: sts.length, maxLength: sts.length }).map((idx) => ({ sts, idx })))
      .map(({ sts, idx }) => ({
        id: 'multi', name: 'M', questions: [], rooms,
        floors: sts.map((s, i) => mkFloor(`f${idx[i]}`, idx[i], s)),
      })),
  )

  it('firstPlayableFloorId returns an existing playable floor (lowest index), or the legacy id', () => {
    fc.assert(
      fc.property(dungeonArb, (d) => {
        const id = firstPlayableFloorId(d)
        if (!d.floors) return id === 'floor-legacy'
        const ready = [...d.floors].filter((f) => f.status === 'ready').sort((a, b) => a.index - b.index)
        if (ready.length === 0) return id === null
        const f = d.floors.find((x) => x.id === id)
        return !!f && f.status === 'ready' && id === ready[0].id
      }),
      opts,
    )
  })
})
