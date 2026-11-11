import { describe, expect, it } from 'vitest'
import { checkLocalName } from './nameRules'
import { SPOOKY_ADJECTIVES, SPOOKY_CREATURES, randomSpookyName, rollAnother } from './spookyNames'
import { OFFLINE_OFFER_MS, WAKE_MAX_MS } from './wakeConstants'
import { describeGuestError, reasonMessage } from './guestMessages'
import { displayHandle } from './handle'
import { firstPlayableFloorId, isFirstTime, pickPreloaded, type PackInput } from './resolvePreloaded'
import type { Dungeon, DungeonSummary, Floor } from '../types/api'

// Mirror of backend/app/core/identity.py (test-only copy).
const RESERVED = ['admin', 'administrator', 'mod', 'moderator', 'staff', 'support', 'system', 'root', 'official',
  'studydungeon', 'kiro', 'ghostrival', 'ghost_rival', 'guest', 'anonymous', 'null', 'undefined', 'examwarden']
const PROFANE = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'bastard', 'nigger', 'faggot']
const LOOK: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' }
function moderationForm(s: string): string {
  let n = s.normalize('NFKC').toLowerCase()
  for (const [k, v] of Object.entries(LOOK)) n = n.split(k).join(v)
  return n.replace(/[\s_-]+/g, '')
}

describe('checkLocalName', () => {
  it('accepts a normal name and trims', () => {
    expect(checkLocalName('  Pale Moth ')).toEqual({ ok: true, name: 'Pale Moth' })
  })
  it.each([
    ['', 'too_short'],
    ['ab', 'too_short'],
    ['a'.repeat(17), 'too_long'],
    ['_abc', 'characters'],
    ['abc-', 'characters'],
    ['ab$c', 'characters'],
    ['ab  cd', 'characters'],
    ['Zoë Ray', 'characters'],
  ])('%j -> %s', (raw, reason) => {
    const r = checkLocalName(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe(reason)
      expect(r.message.length).toBeGreaterThan(0)
    }
  })
  it('does not check reserved words', () => {
    expect(checkLocalName('Admin').ok).toBe(true)
  })
})

describe('spooky names', () => {
  it('lists are frozen, ASCII letters, at most 7 letters', () => {
    for (const list of [SPOOKY_ADJECTIVES, SPOOKY_CREATURES]) {
      expect(Object.isFrozen(list)).toBe(true)
      expect(list.length).toBeGreaterThanOrEqual(24)
      for (const w of list) expect(w).toMatch(/^[A-Za-z]{1,7}$/)
    }
  })
  it('every combination is valid locally and passes backend-style moderation', () => {
    for (const a of SPOOKY_ADJECTIVES) {
      for (const c of SPOOKY_CREATURES) {
        const name = `${a} ${c}`
        expect(name.length).toBeLessThanOrEqual(16)
        expect(checkLocalName(name).ok).toBe(true)
        const m = moderationForm(name)
        for (const bad of [...RESERVED, ...PROFANE]) expect(m.includes(bad), `${name} ~ ${bad}`).toBe(false)
      }
    }
  })
  it('is deterministic with an rng and honors exclude', () => {
    expect(randomSpookyName(() => 0)).toBe('Hollow Raven')
    expect(randomSpookyName(() => 0, 'Hollow Raven')).not.toBe('Hollow Raven')
  })
  it('rollAnother never returns the current name', () => {
    const cur = randomSpookyName(() => 0.3)
    expect(rollAnother(cur, () => 0.3)).not.toBe(cur)
  })
})

describe('wake constants', () => {
  it('has the agreed values', () => {
    expect(OFFLINE_OFFER_MS).toBe(8_000)
    expect(WAKE_MAX_MS).toBe(60_000)
  })
})

describe('guest messages', () => {
  it('maps reasons', () => {
    expect(reasonMessage('not_allowed')).toBe('That name is not available. Try another.')
    expect(reasonMessage('too_short')).toMatch(/3/)
    expect(reasonMessage('too_long')).toMatch(/16/)
    expect(reasonMessage('characters')).toMatch(/letters/)
    expect(reasonMessage('weird')).toBeTruthy()
  })
  it('describes codes', () => {
    for (const c of ['NAME_INVALID', 'NOTICE_NOT_ACCEPTED', 'SESSION_EXISTS', 'GUEST_CREATION_PAUSED', 'RATE_LIMIT_EXCEEDED',
      'NOT_A_GUEST', 'USERNAME_TAKEN', 'CONFIRMATION_REQUIRED', 'SYSTEM_USER_PROTECTED']) {
      expect(describeGuestError(c)).not.toBe(describeGuestError('SOMETHING_ELSE'))
    }
    expect(describeGuestError('RATE_LIMIT_EXCEEDED', { retry_after_seconds: 12 })).toContain('12 seconds')
    expect(describeGuestError('NAME_INVALID', { reason: 'not_allowed' })).toContain('not available')
  })
})

describe('displayHandle', () => {
  const base = { username: 'guest_ab12cd34', is_guest: true }
  it('follows D10 order', () => {
    expect(displayHandle({ ...base, handle: 'Pale Moth#1234', display_name: 'x', tag: '1' })).toBe('Pale Moth#1234')
    expect(displayHandle({ ...base, display_name: 'Pale Moth', tag: '1234' })).toBe('Pale Moth#1234')
    expect(displayHandle({ ...base, display_name: 'Pale Moth' })).toBe('Pale Moth')
    expect(displayHandle({ username: 'alice', is_guest: false })).toBe('alice')
  })
  it('never returns a guest username', () => {
    expect(displayHandle(base)).toBe('Guest')
    expect(displayHandle(null)).toBe('Guest')
  })
})

describe('resolvePreloaded', () => {
  const pack = (o: Partial<PackInput> & { id: string; order: number }): PackInput => ({
    dungeon_id: `d${o.order}`, status: 'locked', floors_cleared: 0, points_earned: 0, ...o,
  })
  const sum = (id: string, created_at: string, demo = true): DungeonSummary =>
    ({ id, title: id, is_public_demo: demo, created_at, rooms_count: 3 })

  it('picks next_pack_id, then first open, then order 1', () => {
    const packs = [pack({ id: 'a', order: 1, status: 'completed' }), pack({ id: 'b', order: 2, status: 'available' }),
      pack({ id: 'c', order: 3, status: 'in_progress' })]
    expect(pickPreloaded({ packs, next_pack_id: 'c' }, null)?.packId).toBe('c')
    expect(pickPreloaded({ packs, next_pack_id: null }, null)?.packId).toBe('b')
    const done = packs.map((p) => ({ ...p, status: 'completed' }))
    expect(pickPreloaded({ packs: done }, null)?.packId).toBe('a')
  })
  it('falls back to the oldest public demo, else null', () => {
    const ds = [sum('new', '2025-02-01T00:00:00Z'), sum('old', '2025-01-01T00:00:00Z'), sum('priv', '2024-01-01T00:00:00Z', false)]
    expect(pickPreloaded(null, ds)).toEqual({ source: 'dungeon', dungeonId: 'old' })
    expect(pickPreloaded(null, [sum('x', '2025-01-01', false)])).toBeNull()
    expect(pickPreloaded(null, null)).toBeNull()
  })

  const floor = (id: string, index: number, status: Floor['status']): Floor => ({
    id, index, title: id, status, topics: [], boss: { id: 'b', name: 'B', hp: 1 }, rank: null, room_ids: [],
  })
  const dungeon = (floors?: Floor[]): Dungeon => ({
    id: 'd', name: 'D', questions: [], floors,
    rooms: [{ id: 'r1', label: 'R', order: 1, is_boss: true, monster: { id: 'm', name: 'M', max_hp: 5, question_ids: [], kind: 'x' } }],
  })

  it('isFirstTime uses Backend data only', () => {
    expect(isFirstTime(pack({ id: 'a', order: 1, status: 'available' }))).toBe(true)
    expect(isFirstTime(pack({ id: 'a', order: 1, status: 'available', floors_cleared: 1 }))).toBe(false)
    expect(isFirstTime(pack({ id: 'a', order: 1, status: 'available', points_earned: 5 }))).toBe(false)
    expect(isFirstTime(pack({ id: 'a', order: 1, status: 'in_progress' }))).toBe(false)
    expect(isFirstTime(null)).toBe(false)
    expect(isFirstTime(dungeon([floor('f1', 1, 'ready'), floor('f2', 2, 'locked')]))).toBe(true)
    expect(isFirstTime(dungeon([floor('f1', 1, 'cleared')]))).toBe(false)
    expect(isFirstTime(dungeon())).toBe(true) // legacy single floor, ready
  })
  it('firstPlayableFloorId picks the first ready floor', () => {
    expect(firstPlayableFloorId(dungeon([floor('f2', 2, 'ready'), floor('f1', 1, 'cleared'), floor('f3', 3, 'ready')]))).toBe('f2')
    expect(firstPlayableFloorId(dungeon([floor('f1', 1, 'locked')]))).toBeNull()
    expect(firstPlayableFloorId(dungeon())).toBe('floor-legacy')
    expect(firstPlayableFloorId(null)).toBeNull()
  })
})
