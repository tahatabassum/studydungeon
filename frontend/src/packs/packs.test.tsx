import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setApiOverride } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'
import type { ApiClient } from '@/api'
import { PointsPop } from '@/points/PointsPop'
import { Scorecard } from '@/scorecard/Scorecard'
import type { RunSummary } from '@/types/api'
import AllPacksCompletePage from './AllPacksCompletePage'
import PackUnlockedPage from './PackUnlockedPage'
import PacksPage, { LOCKED_TEXT } from './PacksPage'
import { PackHeader } from './PackHeader'
import { packDestination } from './usePackContinue'

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/packs" element={<PacksPage />} />
        <Route path="/packs/unlocked/:packId" element={<PackUnlockedPage />} />
        <Route path="/packs/complete" element={<AllPacksCompletePage />} />
        <Route path="/hdr" element={<PackHeader dungeonId="pack-2-dungeon" />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function mockWithSession(over: Partial<ApiClient> = {}): Promise<ApiClient> {
  const adapter = createMockAdapter()
  await adapter.startDemoSession()
  const api = Object.assign(adapter, over) as ApiClient
  setApiOverride(api)
  return api
}

beforeEach(() => setApiOverride(null))
afterEach(() => {
  cleanup()
  setApiOverride(null)
})

describe('PacksPage', () => {
  it('numbers the packs, shows status, progress, locked text, Play and Sample content', async () => {
    await mockWithSession()
    renderAt('/packs')
    const cards = await screen.findAllByTestId('pack-card')
    expect(cards).toHaveLength(3)
    expect(cards.map((c) => c.getAttribute('data-status'))).toEqual(['available', 'locked', 'locked'])
    expect(screen.getAllByTestId('pack-status').map((e) => e.textContent)).toEqual(['Available', 'Locked', 'Locked'])
    expect(screen.getAllByTestId('pack-floors')[0].textContent).toMatch(/^0 of \d+ floors cleared$/)
    expect(screen.getAllByTestId('pack-points')[0].textContent).toBe('0 points')
    expect(screen.getAllByTestId('pack-locked-text').map((e) => e.textContent?.trim())).toEqual([LOCKED_TEXT, LOCKED_TEXT])
    expect(LOCKED_TEXT).toBe("Clear the previous dungeon's final boss to unlock")
    expect(screen.getAllByTestId('pack-play')).toHaveLength(1)
    // Sample content on Packs 2 and 3 only.
    expect(screen.getAllByTestId('sample-chip')).toHaveLength(2)
    expect(cards[0].querySelector('[data-testid="sample-chip"]')).toBeNull()
  })

  it('shows the PACK_LOCKED notice passed through router state', async () => {
    await mockWithSession()
    render(
      <MemoryRouter initialEntries={[{ pathname: '/packs', state: { packLocked: 'That pack is still locked.' } }]}>
        <PacksPage />
      </MemoryRouter>,
    )
    expect((await screen.findByTestId('pack-locked-notice')).textContent).toContain('still locked')
  })

  it('shows an error with Retry when the packs cannot be loaded (packs off)', async () => {
    await mockWithSession({ getPacks: () => Promise.reject(new Error('nope')) })
    renderAt('/packs')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('unlock and completion screens', () => {
  it('PackUnlockedPage names the pack, shows Sample content and Continue opens its floor map', async () => {
    await mockWithSession()
    renderAt('/packs/unlocked/pack-2')
    expect((await screen.findByTestId('unlocked-title')).textContent).toContain('Pack 2')
    expect(screen.getByTestId('sample-chip').textContent).toBe('Sample content')
    expect(screen.getByTestId('unlocked-continue').getAttribute('href')).toMatch(/^\/campaign\//)
  })

  it('AllPacksCompletePage shows the Daily Haunt button only when the capability is on', async () => {
    await mockWithSession()
    renderAt('/packs/complete')
    expect(await screen.findByText('Upload my notes')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'All dungeons conquered' })).toBeTruthy()
    expect(await screen.findByTestId('complete-haunt')).toBeTruthy()
    cleanup()
    const adapter = createMockAdapter()
    await adapter.startDemoSession()
    const off = Object.create(adapter, { capabilities: { value: { dailyHaunt: false } } }) as ApiClient
    setApiOverride(off)
    renderAt('/packs/complete')
    expect(await screen.findByText('Upload my notes')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('complete-haunt')).toBeNull()
  })

  it('PackHeader shows "Pack N of M", points and Sample content', async () => {
    const api = await mockWithSession()
    const pack2 = (await api.getPacks()).packs[1]
    render(
      <MemoryRouter>
        <PackHeader dungeonId={pack2.dungeon_id} />
      </MemoryRouter>,
    )
    const header = await screen.findByTestId('pack-header')
    expect(header.textContent).toContain('Pack 2 of 3')
    expect(header.textContent).toContain('0 points')
    expect(header.textContent).toContain('Sample content')
  })
})

describe('packDestination', () => {
  const pk = (id: string, status: 'locked' | 'available' | 'completed') => ({
    id, order: Number(id.slice(-1)), title: id, description: '', dungeon_id: `d-${id}`, floors_total: 1, floors_cleared: 0,
    final_boss_cleared: false, status, points_earned: 0,
  })
  it('uses pack_progress first', () => {
    const base = { score: 0, xp: 0, correct: 0, total: 0, accuracy: 0 } as RunSummary
    expect(packDestination({ ...base, pack_progress: { pack_id: 'pack-1', status: 'completed', unlocked_pack_id: 'pack-2', all_completed: false } }, null, null)).toBe('/packs/unlocked/pack-2')
    expect(packDestination({ ...base, pack_progress: { pack_id: 'pack-3', status: 'completed', unlocked_pack_id: null, all_completed: true } }, null, null)).toBe('/packs/complete')
    expect(packDestination({ ...base, pack_progress: { pack_id: 'pack-1', status: 'in_progress', unlocked_pack_id: null, all_completed: false } }, null, null)).toBeNull()
  })
  it('falls back to the refetch diff', () => {
    const before = { packs: [pk('pack-1', 'available'), pk('pack-2', 'locked')], all_completed: false }
    const after = { packs: [pk('pack-1', 'completed'), pk('pack-2', 'available')], all_completed: false }
    expect(packDestination({}, before, after)).toBe('/packs/unlocked/pack-2')
    expect(packDestination({}, after, { packs: [pk('pack-1', 'completed'), pk('pack-2', 'completed')], all_completed: true })).toBe('/packs/complete')
    expect(packDestination({}, before, before)).toBeNull()
    expect(packDestination({}, null, after)).toBeNull()
  })
})

describe('points and labels', () => {
  const summary: RunSummary = { score: 2400, xp: 150, correct: 8, total: 10, accuracy: 0.8, points_earned: 120 }
  it('PointsPop shows amount and reason, and nothing for zero', () => {
    render(<PointsPop awarded={10} reason="repeat_correct" />)
    expect(screen.getByTestId('points-pop').textContent).toBe('+10 points, already answered this week')
    cleanup()
    const { container } = render(<PointsPop awarded={0} reason="wrong" />)
    expect(container.textContent).toBe('')
  })

  it('Scorecard says Dungeon score and Leaderboard points with an explanation', () => {
    render(<Scorecard summary={summary} onPlayAgain={() => {}} onExit={() => {}} />)
    expect(screen.getByText('Dungeon score')).toBeTruthy()
    expect(screen.getByTestId('leaderboard-points').textContent).toMatch(/Leaderboard points.*120.*ranking counts/)
    expect(screen.queryByTestId('scorecard-continue')).toBeNull()
  })

  it('Scorecard shows Continue only when given an action', () => {
    render(<Scorecard summary={summary} onPlayAgain={() => {}} onExit={() => {}} onContinue={() => {}} />)
    expect(screen.getByTestId('scorecard-continue')).toBeTruthy()
  })
})
