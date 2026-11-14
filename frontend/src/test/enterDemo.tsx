/**
 * Shared flow-test helper for the new entry flow (frontend-10, D35):
 * Try the Demo -> Name_Screen -> "Accept and continue" -> Path_Choice (preloaded card) -> a route.
 * Flow tests that are about the campaign (not the entry) use it to reach the floor map.
 * Callers mock `@/api` (getApi) and Phaser themselves, as before.
 */
import { useEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import App from '@/App'
import { SessionProvider } from '@/state/SessionContext'

const nav = { go: (path: string): void => void path }

function GrabNavigate() {
  const navigate = useNavigate()
  useEffect(() => {
    nav.go = (path) => navigate(path)
  }, [navigate])
  return null
}

/** Renders the whole app on the landing page. */
export function renderApp(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <GrabNavigate />
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
}

/** Landing -> Try the Demo -> Name_Screen -> Accept and continue -> preloaded card on /choose. */
export async function enterDemoAsGuest(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  renderApp()
  await user.click(screen.getByRole('button', { name: /try the demo/i }))
  // A player who already has a session (a second render on the same adapter) goes straight to /choose.
  const first = await screen.findByRole('button', { name: /Accept and continue|Play preloaded dungeons/ })
  if (/Accept and continue/.test(first.textContent ?? '')) await user.click(first)
  await screen.findByRole('button', { name: /Play preloaded dungeons/ })
}

/** Same, then opens the floor map of the preloaded demo dungeon. */
export async function openDemoMap(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await enterDemoAsGuest(user)
  act(() => nav.go('/campaign/demo-dungeon'))
  await screen.findByRole('heading', { level: 1, name: 'Your notes became 2 floors' })
}
