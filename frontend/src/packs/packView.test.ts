import { describe, expect, it } from 'vitest'
import { currentPack, packLabel, unlockedBetween } from './packView'
import { pointsText } from '../points/pointsText'
import { createOfflineAdapter } from '../offline'
import { capabilityOf } from '../api/ApiClient'
import { createMockAdapter } from '../api/mock/mockAdapter'
import { resolvePreloadedDungeon } from '../identity/resolvePreloaded'
import type { Pack } from '../types/api'

const pack = (order: number, status: Pack['status']): Pack => ({
  id: `pack-${order}`,
  order,
  title: `Pack ${order}`,
  description: '',
  dungeon_id: `dun-${order}`,
  floors_total: 2,
  floors_cleared: 0,
  final_boss_cleared: status === 'completed',
  status,
  points_earned: 0,
})

describe('packView', () => {
  it('currentPack prefers next_pack_id, then the first open pack, then pack 1 when all are done', () => {
    const packs = [pack(1, 'completed'), pack(2, 'available'), pack(3, 'locked')]
    expect(currentPack({ packs, next_pack_id: 'pack-2' })?.id).toBe('pack-2')
    expect(currentPack({ packs, next_pack_id: 'pack-3' })?.id).toBe('pack-2')
    expect(currentPack({ packs, next_pack_id: null })?.id).toBe('pack-2')
    expect(currentPack({ packs: packs.map((p) => ({ ...p, status: 'completed' as const })), next_pack_id: null })?.id).toBe('pack-1')
    expect(currentPack({ packs: [], next_pack_id: null })).toBeNull()
  })

  it('unlockedBetween lists locked -> available only', () => {
    const before = [pack(1, 'available'), pack(2, 'locked'), pack(3, 'locked')]
    const after = [pack(1, 'completed'), pack(2, 'available'), pack(3, 'locked')]
    expect(unlockedBetween(before, after).map((p) => p.id)).toEqual(['pack-2'])
    expect(unlockedBetween(after, after)).toEqual([])
  })

  it('packLabel reads "Pack N of M"', () => {
    expect(packLabel(pack(2, 'available'), 3)).toBe('Pack 2 of 3')
  })
})

describe('pointsText', () => {
  it('words known reasons and hides what it cannot explain', () => {
    expect(pointsText(10, 'repeat_correct')).toBe('+10 points, already answered this week')
    expect(pointsText(1, 'first_correct')).toBe('+1 point, first correct answer this week')
    expect(pointsText(10, 'mystery')).toBe('+10 points')
    expect(pointsText(0, 'wrong')).toBeNull()
    expect(pointsText(undefined)).toBeNull()
    expect(pointsText(Number.NaN, 'retry')).toBeNull()
  })
})

describe('resolvePreloadedDungeon with packs (frontend-10 task 5.4)', () => {
  it('takes the pack source in mock mode', async () => {
    const api = createMockAdapter()
    await api.startDemoSession()
    const out = await resolvePreloadedDungeon(api, { hasSession: true })
    expect(out.dungeonId).toBe('demo-dungeon')
    expect(out.firstTime).toBe(true)
  })

  it('falls through to the dungeon list when getPacks fails', async () => {
    const api = createMockAdapter()
    await api.startDemoSession()
    api.getPacks = async () => {
      throw new Error('down')
    }
    const out = await resolvePreloadedDungeon(api, { hasSession: true })
    expect(out.dungeonId).toBe('demo-dungeon')
  })

  it('skips packs when the capability is off', async () => {
    const api = createMockAdapter()
    await api.startDemoSession()
    let called = false
    const off = Object.assign(Object.create(api) as typeof api, {
      capabilities: { packs: false } as never,
      getPacks: async () => {
        called = true
        throw new Error('no')
      },
    })
    await resolvePreloadedDungeon(off, { hasSession: true })
    expect(called).toBe(false)
  })
})

describe('Offline_Demo packs', () => {
  it('keeps the packs capability off and answers 501', async () => {
    const api = createOfflineAdapter()
    expect(capabilityOf(api, 'packs')).toBe('off')
    await expect(api.getPacks()).rejects.toMatchObject({ status: 501 })
  })
})
