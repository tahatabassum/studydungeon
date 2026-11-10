/**
 * Touch play at the page level (Mock_Adapter, Phaser mocked at the GameCanvas/bridge boundary):
 * the overlay shows only in touch mode, Engage sends engage-request and the encounter starts, the
 * overlay hides while the popup or the pause menu is open, and the Pause button works like Esc.
 */
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import demoDungeon from '@/demo/demoDungeon.json'
import type { GameBridge, ToGameEvent } from '@/game/events'
import type { Dungeon } from '@/types/api'
import { TOUCH_OVERRIDE_KEY } from '@/touch/useTouchMode'

const h = vi.hoisted(() => ({
  api: null as unknown,
  bridge: null as unknown,
  events: [] as unknown[],
  /** What the fake Phaser does when React presses Engage (the real one runs shouldEngage). */
  onEngage: null as null | (() => void),
}))

vi.mock('phaser', () => ({ default: {} }))

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

vi.mock('@/game/GameCanvas', () => ({
  GameCanvas: ({ bridge }: { bridge: GameBridge }) => {
    useEffect(() => {
      h.bridge = bridge
      const off = bridge.onToGame((e) => {
        h.events.push(e)
        if (e.type === 'engage-request') h.onEngage?.()
      })
      bridge.emit({ type: 'ready' })
      return off
    }, [bridge])
    return <div role="application" aria-label="Dungeon game" tabIndex={0} />
  },
}))

import App from '@/App'
import { OpenLegacyPlay } from '@/pages/OpenLegacyPlay'
import { SessionProvider } from '@/state/SessionContext'

const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge
const dungeon = demoDungeon as unknown as Dungeon
const room1 = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0]
const emit = (e: Parameters<GameBridge['emit']>[0]) => act(() => gameBridge().emit(e))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <OpenLegacyPlay />
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.api = createMockAdapter({ seedRevenants: false })
  h.bridge = null
  h.events = []
  h.onEngage = null
})
afterEach(() => {
  cleanup()
  sessionStorage.removeItem(TOUCH_OVERRIDE_KEY)
  delete document.documentElement.dataset.touch
  vi.restoreAllMocks()
})

describe('touch play flow', () => {
  it('desktop: no touch overlay, no Pause button, keyboard legend, and no touch events are sent', async () => {
    renderPlay()
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    expect(screen.queryByTestId('touch-controls')).toBeNull()
    expect(screen.queryByTestId('pause-button')).toBeNull()
    expect(screen.getByText('WASD')).toBeTruthy()
    expect(sent().some((e) => e.type === 'set-touch-mode')).toBe(false)
  })

  it('touch: joystick and Engage show, Engage starts the encounter, the overlay hides during it', async () => {
    sessionStorage.setItem(TOUCH_OVERRIDE_KEY, '1')
    renderPlay()
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    await vi.waitFor(() => expect(gameBridge()).toBeTruthy())

    expect(screen.getByTestId('virtual-joystick')).toBeTruthy()
    expect(screen.getByText('Use the stick to move, tap Engage')).toBeTruthy()
    expect(sent()).toContainEqual({ type: 'set-touch-mode', value: true })
    const engage = screen.getByTestId('engage-button') as HTMLButtonElement
    expect(engage.disabled).toBe(true)

    // Phaser reports the monster in range; pressing Engage sends engage-request, and the fake scene
    // answers like InteractionSystem does (encounter-started).
    emit({ type: 'engage-available', kind: 'monster', name: room1.monster.name })
    expect(engage.textContent).toBe(`Fight ${room1.monster.name}`)
    h.onEngage = () => gameBridge().emit({ type: 'encounter-started', monsterId: room1.monster.id })
    fireEvent.click(engage)
    expect(sent()).toContainEqual({ type: 'engage-request' })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('button').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('touch-controls')).toBeNull()
  })

  it('the Pause button does what Esc does, and the overlay hides while paused', async () => {
    sessionStorage.setItem(TOUCH_OVERRIDE_KEY, '1')
    renderPlay()
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: 'Pause game' }))
    await vi.waitFor(() => expect(sent()).toContainEqual({ type: 'set-phase', phase: 'paused' }))
    expect(screen.queryByTestId('touch-controls')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /resume/i }))
    await vi.waitFor(() => expect(screen.getByTestId('touch-controls')).toBeTruthy())
  })

  it('the rotate hint is dismissible and never blocks play', async () => {
    sessionStorage.setItem(TOUCH_OVERRIDE_KEY, '1')
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('portrait'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    renderPlay()
    await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
    const hint = await screen.findByTestId('rotate-hint')
    expect(hint.textContent).toContain('Rotate your phone for the best view')
    expect(screen.getByTestId('virtual-joystick')).toBeTruthy()
    fireEvent.click(within(hint).getByRole('button'))
    expect(screen.queryByTestId('rotate-hint')).toBeNull()
    vi.unstubAllGlobals()
  })
})
