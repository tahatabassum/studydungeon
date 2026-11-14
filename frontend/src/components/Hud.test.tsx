import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

import { Hud } from './Hud'

const base = { playerHp: 100, maxPlayerHp: 100, monsterHp: 50, maxMonsterHp: 50, xp: 0 }

afterEach(() => {
  cleanup()
  rm.reduced = false
})

describe('Hud player name', () => {
  it('shows the handle in the full HUD only', () => {
    const { unmount } = render(<Hud {...base} playerName="Pale Moth#1234" />)
    expect(screen.getByTestId('hud-player-name').textContent).toBe('Pale Moth#1234')
    unmount()
    render(<Hud {...base} compact playerName="Pale Moth#1234" />)
    expect(screen.queryByTestId('hud-player-name')).toBeNull()
  })

  it('renders no label without a name', () => {
    render(<Hud {...base} />)
    expect(screen.queryByTestId('hud-player-name')).toBeNull()
  })
})

describe('Hud halloween frame', () => {
  it('shows no low-health state at full health', () => {
    const { container } = render(<Hud {...base} />)
    expect(screen.queryByText('Low health')).toBeNull()
    expect(container.querySelector('.sd-lowhp')).toBeNull()
  })

  it('shows the red pulse at 25% health or below', () => {
    const { container } = render(<Hud {...base} playerHp={25} />)
    expect(screen.getByText('Low health')).toBeTruthy()
    expect(container.querySelector('.sd-lowhp')).not.toBeNull()
  })

  it('does not show the pulse just above 25%', () => {
    const { container } = render(<Hud {...base} playerHp={26} />)
    expect(container.querySelector('.sd-lowhp')).toBeNull()
  })

  it('drops the pulse but keeps the text under reduced motion', () => {
    rm.reduced = true
    const { container } = render(<Hud {...base} playerHp={10} />)
    expect(container.querySelector('.sd-lowhp')).toBeNull()
    expect(screen.getByText('Low health')).toBeTruthy()
  })

  it('compact mode keeps health and XP, drops the room strip and level detail', () => {
    const rooms = [{ id: 'a', label: 'A', is_boss: false }]
    const { container } = render(
      <Hud {...base} compact rooms={rooms} currentRoomId="a" clearedRoomIds={[]} level={2} totalXp={120} xpToNext={80} />,
    )
    expect(container.querySelector('[data-hud-mode="compact"]')).not.toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Player health' })).toBeTruthy()
    expect(screen.getByText('XP 0')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Dungeon progress' })).toBeNull()
    expect(screen.queryByText(/to next/)).toBeNull()
  })

  it('real mode: without xp_to_next it shows total XP only, and with it the full line', () => {
    const { rerender } = render(<Hud {...base} level={2} totalXp={120} />)
    expect(screen.getByText('Total 120 XP')).toBeTruthy()
    expect(screen.queryByText(/to next/)).toBeNull()
    rerender(<Hud {...base} level={2} totalXp={120} xpToNext={80} />)
    expect(screen.getByText(/Total 120 XP .* 80 to next/)).toBeTruthy()
  })

  it('shows the boss HP it is given, not an assumed one (220 / 220)', () => {
    render(<Hud {...base} monsterHp={220} maxMonsterHp={220} isBoss />)
    expect(screen.getByText('220 / 220')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Monster health' }).getAttribute('aria-valuemax')).toBe('220')
  })

  it('shows the Haunted memories counter only when a count is given, in full and compact modes', () => {
    const { rerender } = render(<Hud {...base} />)
    expect(screen.queryByTestId('haunted-counter')).toBeNull()
    rerender(<Hud {...base} hauntedDue={3} />)
    expect(screen.getByTestId('haunted-counter').getAttribute('data-count')).toBe('3')
    expect(screen.getByText('Haunted memories due')).toBeTruthy()
    rerender(<Hud {...base} compact hauntedDue={0} />)
    expect(screen.getByTestId('haunted-counter').getAttribute('data-count')).toBe('0')
    // Compact keeps the full label for assistive tech.
    expect(screen.getByText('Haunted memories due').className).toContain('sr-only')
  })

  it('draws candle flame on the current room only', () => {
    const rooms = [
      { id: 'a', label: 'A', is_boss: false },
      { id: 'b', label: 'B', is_boss: true },
    ]
    const { container } = render(
      <Hud {...base} rooms={rooms} currentRoomId="a" clearedRoomIds={[]} />,
    )
    expect(container.querySelectorAll('[data-testid="room-flame"]').length).toBe(1)
  })
})
