/**
 * Floor map examples: node rendering per status, fog on locked floors, Retry on failed ones,
 * Continue, keyboard-only play, windowing and the generation poller.
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 3.10, 14.2**
 */
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFloorFixture, type FixtureStatusMode } from '../api/mock/fixtures/floorFixture'
import type { Floor } from '../types/api'
import { FloorMap, type FloorMapProps } from './FloorMap'
import { describeChanges, mergeStatuses, useGenerationStatus } from './useGenerationStatus'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mount(count: number, mode: FixtureStatusMode = 'mixed', props: Partial<FloorMapProps> = {}) {
  const fixture = buildFloorFixture(count, mode)
  const handlers = { onOpenFloor: vi.fn(), onOpenFinal: vi.fn(), onRetryFloor: vi.fn() }
  const view = render(
    <MemoryRouter>
      <FloorMap
        title="Computer Basics Crypt"
        floors={fixture.floors}
        finalBoss={fixture.final_boss}
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  )
  return { fixture, ...handlers, ...view }
}

describe('FloorMap nodes', () => {
  it('shows the header, one node per floor and the Final_Boss at the end of the path', () => {
    mount(3)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your notes became 3 floors')
    expect(screen.getAllByTestId(/^floor-node-/)).toHaveLength(3)
    // Direct children of the Floors list: the cards hold their own topic lists.
    const items = Array.from(screen.getByRole('list', { name: 'Floors' }).children)
    expect(items).toHaveLength(4)
    expect(items[3].getAttribute('data-testid')).toBe('final-boss-node')
    expect(items[3].getAttribute('data-status')).toBe('locked')
    for (const node of screen.getAllByTestId(/^floor-node-/)) {
      expect(within(node).getByTestId('floor-boss-icon')).toBeTruthy()
      expect(within(node).getByTestId('floor-status')).toBeTruthy()
    }
  })

  it('uses the singular for a single floor', () => {
    mount(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your notes became 1 floor')
  })

  it('gives each status its own treatment: ready, summoning with a spinner, locked with fog', () => {
    mount(3)
    const [ready, generating, locked] = [1, 2, 3].map((n) => screen.getByTestId(`floor-node-${n}`))
    expect(within(ready).getByTestId('floor-status').textContent).toBe('Ready')
    expect(within(ready).queryByTestId('floor-fog')).toBeNull()
    expect(within(generating).getByTestId('floor-spinner')).toBeTruthy()
    expect(within(generating).getByText('Floor 2 is being summoned...')).toBeTruthy()
    expect(within(locked).getByTestId('floor-fog')).toBeTruthy()
    expect(within(locked).getByTestId('floor-status').textContent).toBe('Locked')
    expect(within(screen.getByTestId('final-boss-node')).getByTestId('floor-fog')).toBeTruthy()
  })

  it('shows the rank on a cleared node and unlocks the Final_Boss when every floor is cleared', () => {
    mount(3, 'cleared')
    for (const node of screen.getAllByTestId(/^floor-node-/)) {
      expect(within(node).getByTestId('floor-status').textContent).toBe('Cleared')
      expect(within(node).getByTestId('floor-rank').textContent).toMatch(/^[SABC]$/)
    }
    const boss = screen.getByTestId('final-boss-node')
    expect(boss.getAttribute('data-status')).toBe('ready')
    expect(within(boss).queryByTestId('floor-fog')).toBeNull()
  })

  it('shows a Retry button on a failed floor and calls it', async () => {
    const user = userEvent.setup()
    const { onRetryFloor, fixture } = mount(10)
    const failed = fixture.floors.find((f) => f.status === 'failed')!
    const node = screen.getByTestId(`floor-node-${failed.index}`)
    expect(within(node).getByText(`Floor ${failed.index} could not be summoned`)).toBeTruthy()
    await user.click(within(node).getByRole('button', { name: `Retry Floor ${failed.index}` }))
    expect(onRetryFloor).toHaveBeenCalledWith(expect.objectContaining({ id: failed.id }))
  })

  it('gives every node an accessible name with floor, status and boss', () => {
    mount(3)
    const seal = screen.getByRole('button', { name: /^Floor 1, Floor 1\. Ready\. Boss Warden 1/ })
    expect(seal).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Final boss, The Exam Warden\. Locked until every floor is cleared/ })).toBeTruthy()
  })

  it('hides campaign extras when the backend has no floors: one honest floor, no ring, no Final_Boss', () => {
    const fixture = buildFloorFixture(1, 'ready')
    render(
      <MemoryRouter>
        <FloorMap
          title="The Crypt"
          floors={[{ ...fixture.floors[0], title: 'The Crypt' }]}
          finalBoss={fixture.final_boss}
          extras={false}
          onOpenFloor={vi.fn()}
          onOpenFinal={vi.fn()}
          onRetryFloor={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Crypt')
    expect(screen.queryByTestId('final-boss-node')).toBeNull()
    expect(screen.queryByTestId('mastery-arc')).toBeNull()
    expect(screen.queryByText(/Your notes became/)).toBeNull()
  })

  it('shows an empty state when there are no floors', () => {
    render(
      <MemoryRouter>
        <FloorMap title="Empty" floors={[]} onOpenFloor={vi.fn()} onOpenFinal={vi.fn()} onRetryFloor={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Your notes are not ready yet').length).toBeGreaterThan(0)
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('FloorMap Continue and activation', () => {
  it('Continue opens the first ready floor', async () => {
    const user = userEvent.setup()
    const { onOpenFloor, fixture } = mount(3)
    expect(screen.getByTestId('continue-hint').textContent).toBe('Next: Floor 1, Floor 1')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(onOpenFloor).toHaveBeenCalledWith(fixture.floors[0]))
  })

  it('Continue opens the Final_Boss when every floor is cleared', async () => {
    const user = userEvent.setup()
    const { onOpenFinal, onOpenFloor } = mount(3, 'cleared')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(onOpenFinal).toHaveBeenCalledTimes(1))
    expect(onOpenFloor).not.toHaveBeenCalled()
  })

  it('Continue is disabled with a reason when nothing is playable', () => {
    mount(3, 'locked')
    const button = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-describedby')).toBe('map-continue-hint')
    expect(screen.getByTestId('continue-hint').textContent).toBe('No floor is ready yet.')
  })

  it('a locked floor announces itself instead of opening', async () => {
    const user = userEvent.setup()
    const { onOpenFloor } = mount(3)
    await user.click(screen.getByRole('button', { name: /^Floor 3, Floor 3\. Locked/ }))
    expect(onOpenFloor).not.toHaveBeenCalled()
    expect(screen.getByTestId('map-live').textContent).toContain('Floor 3 is locked. Clear Floor 2 first.')
  })

  it('shows and dismisses a start error', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    mount(3, 'mixed', { errorMessage: 'That floor is still locked.', onDismissError: onDismiss })
    expect(screen.getByRole('alert').textContent).toContain('That floor is still locked.')
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe('FloorMap keyboard', () => {
  it('uses a roving tabindex: only the next playable node is in the tab order', () => {
    mount(3)
    const seals = screen.getAllByRole('button').filter((b) => b.className.includes('sd-fnode__seal'))
    expect(seals.map((s) => s.tabIndex)).toEqual([0, -1, -1, -1])
  })

  it('arrow keys, Home and End move focus and Enter opens a floor, with no mouse', async () => {
    const user = userEvent.setup()
    const { onOpenFloor, fixture } = mount(3, 'ready')
    const seals = () => screen.getAllByRole('button').filter((b) => b.className.includes('sd-fnode__seal'))
    seals()[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(seals()[1])
    expect(seals()[1].tabIndex).toBe(0)
    expect(seals()[0].tabIndex).toBe(-1)
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(seals()[3])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(seals()[0])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onOpenFloor).toHaveBeenCalledWith(fixture.floors[1])
  })

  it('Enter on a failed floor retries it', async () => {
    const user = userEvent.setup()
    const { onRetryFloor } = mount(1, 'failed')
    const seal = screen.getAllByRole('button').find((b) => b.className.includes('sd-fnode__seal'))!
    seal.focus()
    await user.keyboard('{Enter}')
    expect(onRetryFloor).toHaveBeenCalledTimes(1)
  })
})

describe('FloorMap windowing', () => {
  it('renders only the nodes near the viewport for 25 floors, and reaches the last with End', async () => {
    const user = userEvent.setup()
    mount(25, 'ready')
    const rendered = () => screen.getByRole('list', { name: 'Floors' }).children.length
    expect(rendered()).toBeLessThan(12)
    const first = screen.getAllByRole('button').find((b) => b.className.includes('sd-fnode__seal'))!
    first.focus()
    await user.keyboard('{End}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Final boss/)
    expect(screen.getByTestId('final-boss-node')).toBeTruthy()
    // The focused node and its neighbours render; the top of the map is out of the window.
    expect(screen.queryByTestId('floor-node-1')).toBeNull()
  })

  it('draws the path in chunks, not all 26 segments, for 25 floors', () => {
    mount(25, 'ready')
    const segments = screen.getByTestId('map-path').querySelectorAll('.sd-path--core')
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.length).toBeLessThan(25)
  })
})

describe('FloorMap horizontal scrolling', () => {
  const sealOf = (n: number) => within(screen.getByTestId(`floor-node-${n}`)).getByRole('button', { name: new RegExp(`^Floor ${n},`) })

  it('has named prev and next buttons, disabled at the ends', () => {
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    const scroll = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(3000)
    try {
      mount(25, 'ready')
      const prev = screen.getByRole('button', { name: 'Scroll the map to earlier floors' }) as HTMLButtonElement
      const next = screen.getByRole('button', { name: 'Scroll the map to later floors' }) as HTMLButtonElement
      expect(prev.disabled).toBe(true)
      expect(next.disabled).toBe(false)
      expect(screen.getByTestId('map-scroll').parentElement?.getAttribute('data-overflow')).toBe('true')
    } finally {
      width.mockRestore()
      scroll.mockRestore()
    }
  })

  it('a pointer drag pans the map but never opens the node under the pointer', () => {
    const { onOpenFloor, fixture } = mount(3, 'ready')
    const scroller = screen.getByTestId('map-scroll')
    const ptr = { pointerId: 1, pointerType: 'mouse', button: 0 }
    fireEvent.pointerDown(scroller, { ...ptr, clientX: 400 })
    fireEvent.pointerMove(scroller, { ...ptr, clientX: 250 })
    expect(scroller.dataset.dragging).toBe('true')
    fireEvent.pointerUp(scroller, { ...ptr, clientX: 250 })
    expect(scroller.dataset.dragging).toBeUndefined()
    fireEvent.click(sealOf(1))
    expect(onOpenFloor).not.toHaveBeenCalled()
    // The next, plain click works again.
    fireEvent.click(sealOf(1))
    expect(onOpenFloor).toHaveBeenCalledWith(fixture.floors[0])
  })

  it('a press that barely moves is still a click', () => {
    const { onOpenFloor } = mount(3, 'ready')
    const scroller = screen.getByTestId('map-scroll')
    const ptr = { pointerId: 1, pointerType: 'mouse', button: 0 }
    fireEvent.pointerDown(scroller, { ...ptr, clientX: 400 })
    fireEvent.pointerMove(scroller, { ...ptr, clientX: 402 })
    fireEvent.pointerUp(scroller, { ...ptr, clientX: 402 })
    fireEvent.click(sealOf(1))
    expect(onOpenFloor).toHaveBeenCalledTimes(1)
  })

  it('keeps every node reachable by the keyboard on a wide map: Right, PageDown, End, then Home', async () => {
    const user = userEvent.setup()
    mount(25, 'ready')
    const focusedSeal = () => document.activeElement as HTMLElement
    screen.getByRole('button', { name: /^Floor 1,/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(focusedSeal().getAttribute('aria-label')).toMatch(/^Floor 2,/)
    await user.keyboard('{PageDown}')
    expect(focusedSeal().getAttribute('aria-label')).toMatch(/^Floor 7,/)
    await user.keyboard('{End}')
    expect(focusedSeal().getAttribute('aria-label')).toMatch(/^Final boss/)
    await user.keyboard('{Home}')
    expect(focusedSeal().getAttribute('aria-label')).toMatch(/^Floor 1,/)
  })
})

describe('generation status', () => {
  it('merges a snapshot and describes changes in a polite sentence', () => {
    const { floors } = buildFloorFixture(3, 'mixed')
    const merged = mergeStatuses(floors, {
      dungeon_id: 'x',
      floors: [{ id: floors[1].id, status: 'ready' }, { id: 'unknown', status: 'failed' }],
    })
    expect(merged[1].status).toBe('ready')
    expect(merged[0]).toBe(floors[0])
    expect(describeChanges(null, floors)).toEqual(['Floor 2 is being summoned...'])
    const prev = new Map(floors.map((f) => [f.id, f.status] as const))
    expect(describeChanges(prev, merged)).toEqual(['Floor 2 is ready.'])
    const failed = merged.map((f) => (f.index === 3 ? { ...f, status: 'failed' as const } : f))
    expect(describeChanges(new Map(merged.map((f) => [f.id, f.status] as const)), failed)).toEqual([
      'Floor 3 could not be summoned. Retry is available.',
    ])
  })

  it('polls while a floor is summoning, announces it, and stops when it is ready', async () => {
    vi.useFakeTimers()
    const { floors } = buildFloorFixture(3, 'mixed')
    const fetchStatus = vi.fn(async () => ({
      dungeon_id: 'x',
      floors: floors.map((f) => ({ id: f.id, status: f.status === 'generating' ? ('ready' as const) : f.status })),
    }))
    const { result } = renderHook(() => useGenerationStatus({ floors, fetchStatus, intervalMs: 100 }))
    expect(result.current.announcement).toBe('Floor 2 is being summoned...')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(result.current.floors[1].status).toBe('ready')
    expect(result.current.announcement).toBe('Floor 2 is ready.')
    const calls = fetchStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetchStatus.mock.calls.length).toBe(calls)
  })

  it('pauses while the tab is hidden and gives up after the cap with a way to resume', async () => {
    vi.useFakeTimers()
    const floors: Floor[] = buildFloorFixture(3, 'mixed').floors
    const fetchStatus = vi.fn(async () => ({ dungeon_id: 'x', floors: floors.map((f) => ({ id: f.id, status: f.status })) }))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { result } = renderHook(() => useGenerationStatus({ floors, fetchStatus, intervalMs: 100, timeoutMs: 300 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetchStatus).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetchStatus.mock.calls.length).toBeGreaterThan(0)
    expect(result.current.timedOut).toBe(true)
    expect(result.current.announcement).toBe('Generation is taking longer than usual.')
    visibility.mockRestore()
  })
})
