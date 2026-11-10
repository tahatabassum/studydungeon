/**
 * HUD level display via getProgress (Mock_Adapter, Phaser mocked at the bridge).
 * **Validates: Requirements 11.6, 11.7, 20.3**
 */
import { useEffect } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import type { GameBridge } from '@/game/events'
import demoDungeon from '@/demo/demoDungeon.json'
import type { Dungeon } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown, bridge: null as unknown }))

vi.mock('phaser', () => ({ default: {} }))

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

vi.mock('@/game/GameCanvas', () => ({
  GameCanvas: ({ bridge }: { bridge: GameBridge }) => {
    useEffect(() => {
      h.bridge = bridge
      bridge.emit({ type: 'ready' })
    }, [bridge])
    return <div role="application" aria-label="Dungeon game" tabIndex={0} />
  },
}))

import App from '@/App'
import { OpenLegacyPlay } from '@/pages/OpenLegacyPlay'
import { SessionProvider } from '@/state/SessionContext'

let adapter: ApiClient

async function startDemo() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <OpenLegacyPlay />
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
  await screen.findByText('XP 0')
  await vi.waitFor(() => expect(h.bridge).toBeTruthy())
}

describe('HUD level display', () => {
  beforeEach(() => {
    adapter = createMockAdapter()
    h.api = adapter
    h.bridge = null
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows "Lv 1" after starting the demo', async () => {
    await startDemo()
    expect(await screen.findByText('Lv 1')).toBeTruthy()
  })

  it('shows no level when getProgress rejects, and gameplay still works', async () => {
    vi.spyOn(adapter, 'getProgress').mockRejectedValue(new Error('boom'))
    await startDemo()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByText(/^Lv /)).toBeNull()
    const dungeon = demoDungeon as unknown as Dungeon
    const monsterId = [...dungeon.rooms].sort((a, b) => a.order - b.order)[0].monster.id
    act(() => {
      (h.bridge as GameBridge).emit({ type: 'encounter-started', monsterId })
    })
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
