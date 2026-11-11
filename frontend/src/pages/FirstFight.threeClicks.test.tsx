/**
 * Three-click first fight (design D35, never cut), Mock_Adapter, Phaser faked at the GameCanvas/bridge boundary.
 * Title screen: "Try the Demo" (click 1) -> Name_Screen: "Accept and continue" (click 2) -> Path_Choice: the
 * preloaded card (click 3) -> the first floor runs and the first monster is engaged with the E key or, in
 * Touch_Mode, the Engage button, with no other click. Every click dispatched on the document is counted.
 * **Validates: Requirements 20.6, 5.9, 5.10, 2.1, 2.10**
 *
 * Manual check in real mode (against a local Backend):
 *   1. Start the Backend locally (backend/: alembic upgrade head, then run the API) and seed the preloaded
 *      packs / demo dungeon with the project's seed command so GET /packs (or GET /dungeons) returns an
 *      available pack with nothing cleared.
 *   2. In frontend/ set VITE_USE_MOCKS=false and VITE_API_BASE=http://localhost:8000 (or the local API URL),
 *      then run `npm run dev`.
 *   3. Open http://localhost:5173/ in a fresh browser profile (no cookies) and count clicks:
 *      click 1 "Try the Demo", click 2 "Accept and continue" (prefilled spooky name), click 3 the
 *      highlighted "Play preloaded dungeons" card.
 *   4. Without clicking again, the first floor of the first pack runs; walk to the first monster (WASD or
 *      arrows) and press E: its question pop-up opens. No intro story, tutorial or offline demo may appear.
 *   5. Repeat with ?touch=1 style touch emulation (device toolbar): tap Engage instead of pressing E.
 */
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import type { GameBridge, ToGameEvent } from '@/game/events'
import { TOUCH_OVERRIDE_KEY } from '@/touch/useTouchMode'

const h = vi.hoisted(() => ({
  api: null as unknown,
  bridge: null as unknown,
  events: [] as unknown[],
  monster: null as null | { id: string },
}))

vi.mock('phaser', () => ({ default: {} }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
// The fake game: reports the first monster in range after load-dungeon, and (like InteractionSystem) starts the
// encounter on the E key or on an engage-request from the touch Engage button.
vi.mock('@/game/GameCanvas', () => ({
  GameCanvas: ({ bridge }: { bridge: GameBridge }) => {
    useEffect(() => {
      h.bridge = bridge
      const startFirst = () => {
        if (h.monster) bridge.emit({ type: 'encounter-started', monsterId: h.monster.id })
      }
      const off = bridge.onToGame((e) => {
        h.events.push(e)
        if (e.type === 'load-dungeon') h.monster = { id: e.rooms[0].monster.id }
        if (e.type === 'engage-request') startFirst()
      })
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key.toLowerCase() === 'e') startFirst()
      }
      window.addEventListener('keydown', onKey)
      bridge.emit({ type: 'ready' })
      return () => {
        off()
        window.removeEventListener('keydown', onKey)
      }
    }, [bridge])
    return <div role="application" aria-label="Dungeon game" tabIndex={0} />
  },
}))

import App from '@/App'
import { SessionProvider } from '@/state/SessionContext'

const sent = (): ToGameEvent[] => h.events as ToGameEvent[]
const gameBridge = (): GameBridge => h.bridge as GameBridge

let path = ''
function PathProbe() {
  const pathname = useLocation().pathname
  useEffect(() => {
    path = pathname
  })
  return null
}

let clicks = 0
const countClick = () => {
  clicks += 1
}

async function reachRunningFloor(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <PathProbe />
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /try the demo/i }))
  await user.click(await screen.findByRole('button', { name: 'Accept and continue' }))
  await user.click(await screen.findByRole('button', { name: /Play preloaded dungeons/ }))
  await vi.waitFor(() => expect(sent().some((e) => e.type === 'load-dungeon')).toBe(true))
  await vi.waitFor(() => expect(gameBridge()).toBeTruthy())
}

function expectRunningFirstFloor() {
  expect(clicks).toBe(3)
  expect(path).toMatch(/^\/campaign\/[^/]+\/play\/[^/]+$/)
  expect(screen.getByRole('application', { name: 'Dungeon game' })).toBeTruthy()
  expect(sent().filter((e) => e.type === 'load-dungeon')).toHaveLength(1)
  // No intro story / tutorial dialog and no offline demo on the way.
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(path).not.toMatch(/offline/)
  expect(sessionStorage.getItem('sd.offlineDemo')).toBeNull()
}

describe('three-click first fight (mock mode)', () => {
  let user: ReturnType<typeof userEvent.setup>
  beforeEach(() => {
    clicks = 0
    document.addEventListener('click', countClick, true)
    user = userEvent.setup()
    h.api = createMockAdapter({ seedRevenants: false })
    h.bridge = null
    h.events = []
    h.monster = null
    sessionStorage.clear()
  })
  afterEach(() => {
    document.removeEventListener('click', countClick, true)
    cleanup()
    sessionStorage.removeItem(TOUCH_OVERRIDE_KEY)
    delete document.documentElement.dataset.touch
    vi.restoreAllMocks()
  })

  it('3 clicks reach a running floor and the E key engages the first monster with no further click', async () => {
    await reachRunningFloor(user)
    expectRunningFirstFloor()

    await user.keyboard('e')
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(sent().some((e) => e.type === 'encounter-open')).toBe(true)
    expect(clicks).toBe(3)
  })

  it('Touch_Mode: after 3 clicks the Engage button engages the first monster (a tap, not a path click)', async () => {
    sessionStorage.setItem(TOUCH_OVERRIDE_KEY, '1')
    await reachRunningFloor(user)
    expectRunningFirstFloor()

    const engage = (await screen.findByTestId('engage-button')) as HTMLButtonElement
    act(() => {
      gameBridge().emit({ type: 'engage-available', kind: 'monster', name: 'First monster' })
    })
    expect(engage.disabled).toBe(false)
    const before = clicks
    fireEvent.click(engage)
    expect(clicks - before).toBe(1) // the tap itself, counted separately from the three path clicks
    expect(sent()).toContainEqual({ type: 'engage-request' })
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
