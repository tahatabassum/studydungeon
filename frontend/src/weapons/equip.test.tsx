import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockAdapter } from '../api/mock/mockAdapter'
import { Armory } from './Armory'
import { getEquippedWeapon, setEquippedWeapon } from './equipped'
import { WEAPONS } from './weapons'

const list = WEAPONS.map((w) => ({ id: w.id, unlock_level: w.unlockLevel }))

beforeEach(() => setEquippedWeapon(null))
afterEach(cleanup)

describe('Armory equip', () => {
  it('lets the player equip and unequip an unlocked weapon by keyboard; locked weapons have no button', async () => {
    const user = userEvent.setup()
    render(<Armory weapons={list} level={3} equippable />)
    expect(screen.queryByTestId('equip-flame_sigil')).toBeNull()
    const staff = screen.getByRole('button', { name: 'Equip Arcane Staff' })
    staff.focus()
    await user.keyboard('{Enter}')
    expect(getEquippedWeapon()).toBe('arcane_staff')
    expect(screen.getByRole('button', { name: 'Unequip Arcane Staff' }).getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Enter}')
    expect(getEquippedWeapon()).toBeNull()
  })

  it('shows no equip buttons unless equippable', () => {
    render(<Armory weapons={list} level={3} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('mock equip', () => {
  it('uses the chosen unlocked weapon and rejects a locked one with WEAPON_LOCKED', async () => {
    const api = createMockAdapter({ delayMs: 0 })
    const session = await api.startDemoSession()
    const run = await api.startRun(session.dungeon_id)
    const dungeon = await api.getDungeon(session.dungeon_id)
    const qid = dungeon.rooms[0].monster.question_ids[0]
    await expect(
      api.submitAttempt(run.id, { question_id: qid, selected_answer: 'x', attempt_id: 'a1', weapon_id: 'flame_sigil' }),
    ).rejects.toMatchObject({ code: 'WEAPON_LOCKED' })
    const ok = await api.submitAttempt(run.id, {
      question_id: qid,
      selected_answer: 'x',
      attempt_id: 'a2',
      weapon_id: 'rusty_dagger',
    })
    expect(ok.weapon_id).toBe('rusty_dagger')
  })
})
