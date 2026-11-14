import { describe, expect, it } from 'vitest'
import { createMockAdapter } from './mockAdapter'
import { checkMockName, makeHandle, moderationForm } from './mockGuests'

const PW = 'correct-horse-9'
const notice = { accept_public_notice: true } as const

describe('mock guest name rules (mirror of backend identity.py)', () => {
  it('accepts a normal name and trims it', () => {
    expect(checkMockName('  Ada Lovelace ')).toEqual({ ok: true, display_name: 'Ada Lovelace' })
    expect(checkMockName('a_b-9')).toMatchObject({ ok: true })
  })

  it('maps lengths to too_short / too_long at the boundaries', () => {
    expect(checkMockName('ab')).toMatchObject({ ok: false, reason: 'too_short' })
    expect(checkMockName('   ')).toMatchObject({ ok: false, reason: 'too_short' })
    expect(checkMockName('abc')).toMatchObject({ ok: true })
    expect(checkMockName('a'.repeat(16))).toMatchObject({ ok: true })
    expect(checkMockName('a'.repeat(17))).toMatchObject({ ok: false, reason: 'too_long' })
  })

  it('rejects bad characters, edges and double spaces as "characters"', () => {
    for (const bad of ['-abc', 'abc_', 'ab!cd', 'ab  cd', 'héllo']) {
      expect(checkMockName(bad), bad).toMatchObject({ ok: false, reason: 'characters' })
    }
  })

  it('rejects reserved names, also through lookalikes and separators', () => {
    for (const bad of ['admin', 'Ad-Min', '4dm1n', 'my_system_x', 'K1R0', 'Guest 1']) {
      expect(checkMockName(bad), bad).toMatchObject({ ok: false, reason: 'not_allowed' })
    }
    expect(moderationForm('Ad_m1n')).toBe('admin')
    expect(checkMockName('admin').message).toBe('That name is not available. Try another.')
  })

  it('normalizes full-width letters with NFKC', () => {
    expect(checkMockName('Ａｄａ')).toEqual({ ok: true, display_name: 'Ada' })
  })
})

describe('mock guest identity through the adapter', () => {
  it('create then getMe returns the same guest with a handle, public id and internal username', async () => {
    const api = createMockAdapter()
    const { user, notice_version } = await api.createGuest({ display_name: ' Ada ', ...notice })
    expect(notice_version).toBe('2026-11')
    expect(user.is_guest).toBe(true)
    expect(user.display_name).toBe('Ada')
    expect(user.tag).toMatch(/^[1-9]\d{3}$/)
    expect(user.handle).toBe(makeHandle('Ada', user.tag ?? ''))
    expect(user.public_id).toMatch(/^p_[0-9a-f]{8}$/)
    expect(user.username).toMatch(/^guest_[0-9a-f]{8}$/)
    const me = await api.getMe()
    expect(me?.user).toEqual(user)
  })

  it('gives the same name different tags', async () => {
    const api = createMockAdapter()
    const tags = new Set<string>()
    for (let i = 0; i < 30; i += 1) {
      const { user } = await api.createGuest({ display_name: 'Ada', ...notice })
      tags.add(user.tag ?? '')
      await api.logout()
    }
    expect(tags.size).toBe(30)
  })

  it('422 NOTICE_NOT_ACCEPTED and NAME_INVALID with the reason', async () => {
    const api = createMockAdapter()
    await expect(
      api.createGuest({ display_name: 'Ada', accept_public_notice: false } as never),
    ).rejects.toMatchObject({ status: 422, code: 'NOTICE_NOT_ACCEPTED' })
    await expect(api.createGuest({ display_name: 'x', ...notice })).rejects.toMatchObject({
      status: 422,
      code: 'NAME_INVALID',
      reason: 'too_short',
    })
    expect(await api.getMe()).toBeNull()
  })

  it('checkGuestName reports the same rules', async () => {
    const api = createMockAdapter()
    expect(await api.checkGuestName('Ada')).toEqual({ ok: true, display_name: 'Ada' })
    expect(await api.checkGuestName('admin')).toMatchObject({ ok: false, reason: 'not_allowed' })
  })

  it('409 SESSION_EXISTS on a second create', async () => {
    const api = createMockAdapter()
    await api.createGuest({ display_name: 'Ada', ...notice })
    await expect(api.createGuest({ display_name: 'Bob', ...notice })).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_EXISTS',
    })
  })

  it('upgrade keeps id, public id, name, tag and handle', async () => {
    const api = createMockAdapter()
    const { user: guest } = await api.createGuest({ display_name: 'Ada', ...notice })
    const up = await api.upgradeGuest({ username: 'Ada_Real', password: PW })
    expect(up).toMatchObject({
      id: guest.id,
      public_id: guest.public_id,
      display_name: 'Ada',
      tag: guest.tag,
      handle: guest.handle,
      is_guest: false,
      username: 'ada_real',
    })
    expect((await api.getMe())?.user.is_guest).toBe(false)
    await api.logout()
    expect((await api.login({ username: 'ada_real', password: PW })).handle).toBe(guest.handle)
  })

  it('upgrade: 403 NOT_A_GUEST for a registered user, 409 USERNAME_TAKEN for a taken name', async () => {
    const api = createMockAdapter()
    await api.register({ username: 'taken_one', password: PW })
    await expect(api.upgradeGuest({ username: 'other_one', password: PW })).rejects.toMatchObject({
      status: 403,
      code: 'NOT_A_GUEST',
    })
    await api.logout()
    await api.createGuest({ display_name: 'Ada', ...notice })
    await expect(api.upgradeGuest({ username: 'TAKEN_one', password: PW })).rejects.toMatchObject({
      status: 409,
      code: 'USERNAME_TAKEN',
    })
    await expect(api.upgradeGuest({ username: 'ab', password: PW })).rejects.toMatchObject({ status: 422 })
  })

  it('delete needs the right confirmation, then ends the session and clears the data', async () => {
    const api = createMockAdapter()
    await api.createGuest({ display_name: 'Ada', ...notice })
    const run = await api.startRun('demo-dungeon')
    expect(run.id).toBeTruthy()
    await expect((api.deleteAccount as (confirm?: string) => Promise<void>)('nope')).rejects.toMatchObject({
      status: 422,
      code: 'CONFIRMATION_REQUIRED',
    })
    expect(await api.getMe()).not.toBeNull()
    await (api.deleteAccount as (confirm?: string) => Promise<void>)('DELETE')
    expect(await api.getMe()).toBeNull()
    await expect(api.getRun(run.id)).rejects.toMatchObject({ status: 404 })
    await expect(api.deleteAccount()).rejects.toMatchObject({ status: 401 })
  })

  it('register, login and logout keep working next to a guest session', async () => {
    const api = createMockAdapter()
    await api.createGuest({ display_name: 'Ada', ...notice })
    await api.logout()
    expect(await api.getMe()).toBeNull()
    const user = await api.register({ username: 'plain_user', password: PW })
    expect((await api.getMe())?.user).toEqual(user)
  })

  it('startDemoSession still works as before', async () => {
    const api = createMockAdapter()
    const demo = await api.startDemoSession()
    expect(demo.user.is_guest).toBe(true)
    expect((await api.getMe())?.user.id).toBe(demo.user.id)
  })

  it('a created guest can play a run like a demo guest', async () => {
    const api = createMockAdapter()
    await api.createGuest({ display_name: 'Ada', ...notice })
    const dungeon = await api.getDungeon('demo-dungeon')
    const run = await api.startRun(dungeon.id)
    expect(run.dungeon_id).toBe(dungeon.id)
    expect((await api.getProgress()).level).toBeGreaterThanOrEqual(1)
  })

  it('listDungeons returns the demo dungeon shaped as DungeonSummary', async () => {
    const api = createMockAdapter()
    await expect(api.listDungeons()).rejects.toMatchObject({ status: 401 })
    await api.createGuest({ display_name: 'Ada', ...notice })
    const list = await api.listDungeons()
    expect(list.length).toBeGreaterThanOrEqual(1)
    const demo = list.find((d) => d.is_public_demo)
    expect(demo).toMatchObject({ id: 'demo-dungeon', title: expect.any(String), rooms_count: expect.any(Number) })
    expect(Number.isNaN(Date.parse(demo?.created_at ?? ''))).toBe(false)
  })
})
