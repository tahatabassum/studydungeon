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
