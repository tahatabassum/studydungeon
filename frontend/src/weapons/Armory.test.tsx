import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Armory } from './Armory'
import { WEAPONS } from './weapons'

const list = WEAPONS.map((w) => ({ id: w.id, unlock_level: w.unlockLevel }))

afterEach(cleanup)

describe('Armory', () => {
  it('lists every weapon as unlocked or locked with its unlock level', () => {
    render(<Armory weapons={list} level={3} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    const state = (id: string) => rows.find((r) => r.getAttribute('data-weapon') === id)?.getAttribute('data-unlocked')
    expect(state('rusty_dagger')).toBe('true')
    expect(state('arcane_staff')).toBe('true')
    expect(state('hunter_crossbow')).toBe('true')
    expect(state('spectral_hammer')).toBe('false')
    expect(state('flame_sigil')).toBe('false')
    expect(screen.getByText('Locked: unlocks at level 8')).toBeTruthy()
    expect(screen.getByText('Unlocked (level 2)')).toBeTruthy()
  })

  it('renders nothing without a weapon list or a level', () => {
    const { container, rerender } = render(<Armory weapons={undefined} level={3} />)
    expect(container.firstChild).toBeNull()
    rerender(<Armory weapons={list} level={undefined} />)
    expect(container.firstChild).toBeNull()
    rerender(<Armory weapons={[]} level={3} />)
    expect(container.firstChild).toBeNull()
  })
})
