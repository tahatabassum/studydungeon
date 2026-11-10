/**
 * Floor cards carry their topics with mastery bars and band labels, in normal flow inside the card
 * (nothing overlaps the next card), only for floors that can be measured. Beyond a few topics a
 * "+N more" control opens a popover.
 * **Validates: Requirements 10.1, 10.2**
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFloorFixture } from '../api/mock/fixtures/floorFixture'
import type { Floor } from '../types/api'
import { FloorMap } from './FloorMap'

afterEach(cleanup)

function mount(floors: Floor[], finalBoss = buildFloorFixture(3, 'mixed').final_boss) {
  return render(
    <MemoryRouter>
      <FloorMap title="Crypt" floors={floors} finalBoss={finalBoss} onOpenFloor={vi.fn()} onOpenFinal={vi.fn()} onRetryFloor={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('floor card topic bars', () => {
  it('lists each topic with a mastery bar and its band label on a ready floor, and leaves locked floors bare', () => {
    const fixture = buildFloorFixture(3, 'mixed')
    mount(fixture.floors, fixture.final_boss)
    const ready = fixture.floors.find((f) => f.status === 'ready' || f.status === 'cleared')!
    const list = screen.getByTestId(`floor-topics-${ready.index}`)
    // A real, named list: the topics are readable by assistive tech (unlike the old hover tooltip).
    expect(list.getAttribute('aria-hidden')).toBeNull()
    expect(list.getAttribute('aria-label')).toBe(`Topics on Floor ${ready.index}`)
    const rows = list.querySelectorAll('li')
    expect(rows).toHaveLength(ready.topics.length)
    for (const [i, t] of ready.topics.entries()) {
      const band = t.mastery >= 80 ? 'Strong' : t.mastery >= 50 ? 'Learning' : 'Weak'
      expect(rows[i].textContent).toContain(t.title)
      expect(rows[i].textContent).toContain(`${band} ${Math.round(t.mastery)}`)
      expect(rows[i].querySelector('[data-testid="mastery-arc"]')).toBeTruthy()
    }
    const locked = fixture.floors.find((f) => f.status === 'locked')
    if (locked) expect(screen.queryByTestId(`floor-topics-${locked.index}`)).toBeNull()
    // The ring on the seal still names the average band.
    const node = screen.getByTestId(`floor-node-${ready.index}`)
    expect(within(node).getAllByRole('img', { name: /^Mastery \d+ percent, (Weak|Learning|Strong)$/ }).length).toBeGreaterThan(0)
  })

  it('keeps the topics inside their own card, in normal flow', () => {
    const fixture = buildFloorFixture(3, 'ready')
    mount(fixture.floors, fixture.final_boss)
    const node = screen.getByTestId('floor-node-1')
    const card = node.querySelector('.sd-fcard')!
    expect(card.contains(screen.getByTestId('floor-topics-1'))).toBe(true)
  })

  it('shows a long topic name in full for assistive tech, with a tooltip, and truncates it with CSS only', () => {
    const fixture = buildFloorFixture(3, 'ready')
    const long = 'A very long topic name about the distributed consensus algorithms of the cold, dark crypt'
    const floors = fixture.floors.map((f, i) => (i === 0 ? { ...f, topics: [{ ...f.topics[0], title: long }] } : f))
    mount(floors, fixture.final_boss)
    const name = within(screen.getByTestId('floor-topics-1')).getByText(long)
    expect(name.getAttribute('title')).toBe(long)
  })
})

describe('+N more topics', () => {
  function manyTopics() {
    const fixture = buildFloorFixture(3, 'ready')
    const topics = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, title: `Topic number ${i + 1}`, mastery: 20 + i * 10 }))
    return { fixture, floors: fixture.floors.map((f, i) => (i === 0 ? { ...f, topics } : f)) }
  }

  it('shows the first few topics and a "+N more" button that opens a popover with the rest', async () => {
    const user = userEvent.setup()
    const { fixture, floors } = manyTopics()
    mount(floors, fixture.final_boss)
    const list = screen.getByTestId('floor-topics-1')
    const shown = list.querySelectorAll('li').length
    expect(shown).toBeLessThan(7)
    const button = screen.getByRole('button', { name: `+${7 - shown} more topics on Floor 1` })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('floor-more-1')).toBeNull()

    await user.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const pop = screen.getByRole('group', { name: 'More topics on Floor 1' })
    expect(button.getAttribute('aria-controls')).toBe(pop.id)
    expect(pop.querySelectorAll('li')).toHaveLength(7 - shown)
    expect(pop.textContent).toContain(`Topic number ${shown + 1}`)
  })

  it('closes on Escape and gives focus back to the button', async () => {
    const user = userEvent.setup()
    const { fixture, floors } = manyTopics()
    mount(floors, fixture.final_boss)
    const button = screen.getByRole('button', { name: /^\+\d+ more topics on Floor 1$/ })
    button.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('floor-more-1')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('floor-more-1')).toBeNull()
    expect(document.activeElement).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when the pointer goes down outside it', async () => {
    const user = userEvent.setup()
    const { fixture, floors } = manyTopics()
    mount(floors, fixture.final_boss)
    await user.click(screen.getByRole('button', { name: /^\+\d+ more topics on Floor 1$/ }))
    expect(screen.getByTestId('floor-more-1')).toBeTruthy()
    await user.click(screen.getByRole('heading', { level: 1 }))
    expect(screen.queryByTestId('floor-more-1')).toBeNull()
  })
})
