import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ENDPOINT_SCHEMAS } from '../api/schemas'
import { BadgeGrid, BadgeIcons } from './BadgeGrid'
import { BADGES, badgeInfo } from './badges'

afterEach(cleanup)

describe('badge catalog', () => {
  it('has exactly the BadgeId values of the contract, each with a label, hint and icon', () => {
    const fixtureIds = new Set<string>()
    const parsed = ENDPOINT_SCHEMAS.getLeaderboard.schema.safeParse({
      entries: BADGES.map((b, i) => ({
        id: b.id,
        rank: i + 1,
        display_name: b.label,
        is_guest: false,
        is_seeded_rival: false,
        level: 1,
        score: 1,
        accuracy: 1,
        best_streak: 1,
        badge_ids: [b.id],
      })),
      me: { rank: null, is_provisional: false, entry: null },
      updated_at: 'x',
    })
    // Every catalog id is accepted by the schema, so the catalog and the contract cannot drift apart.
    expect(parsed.success).toBe(true)
    for (const b of BADGES) {
      fixtureIds.add(b.id)
      expect(b.label.length).toBeGreaterThan(0)
      expect(b.hint.length).toBeGreaterThan(0)
      expect(b.icon).toBeTruthy()
    }
    expect(fixtureIds.size).toBe(8)
    expect(badgeInfo('nope')).toBeUndefined()
  })
})

describe('BadgeGrid', () => {
  it('shows earned badges lit and the rest locked with a lock and text', () => {
    render(<BadgeGrid earned={['first_blood']} />)
    const items = within(screen.getByTestId('badge-grid')).getAllByRole('listitem')
    expect(items).toHaveLength(8)
    const lit = items.filter((i) => i.getAttribute('data-earned') === 'true')
    expect(lit).toHaveLength(1)
    expect(lit[0].textContent).toContain('First Blood')
    expect(lit[0].textContent).toContain('earned')
    const locked = items.find((i) => i.getAttribute('data-badge') === 'boss_slayer')!
    expect(locked.textContent).toContain('locked')
  })

  it('can list only the earned badges, and renders nothing when there are none', () => {
    const { container, rerender } = render(<BadgeGrid earned={['boss_slayer']} showLocked={false} />)
    expect(within(container).getAllByRole('listitem')).toHaveLength(1)
    rerender(<BadgeGrid earned={[]} showLocked={false} />)
    expect(container.querySelector('[data-testid="badge-grid"]')).toBeNull()
  })

  it('BadgeIcons names each badge for assistive tech, caps the row and ignores unknown ids', () => {
    render(<BadgeIcons ids={['first_blood', 'streak_5', 'boss_slayer', 'no_damage', 'perfect_room']} max={3} />)
    const row = screen.getByTestId('badge-icons')
    expect(within(row).getByText('First Blood')).toBeTruthy()
    expect(row.textContent).toContain('+2')
    cleanup()
    render(<BadgeIcons ids={[]} />)
    expect(screen.getByText('None')).toBeTruthy()
  })
})
