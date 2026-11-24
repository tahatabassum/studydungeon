/**
 * Entry guard on /, /login and /register (frontend-13, task 1.1).
 * **Validates: Requirements 1.4, 1.5, 1.6, 1.9**
 */
import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  value: { user: null as unknown, restoring: false, dungeonId: null, expiresAt: null },
}));

vi.mock('phaser', () => ({ default: {} }));
vi.mock('@/game/GameCanvas', () => ({ GameCanvas: () => null }));
vi.mock('@/state/SessionContext', () => ({
  useSession: () => ({ ...session.value, setSession: vi.fn(), setUser: vi.fn(), clearSession: vi.fn() }),
}));
vi.mock('@/pages/DashboardPage', () => ({ default: () => <p>dashboard page</p> }));
vi.mock('@/pages/LandingPage', () => ({ default: () => <p>landing page</p> }));
vi.mock('@/auth/LoginPage', () => ({ default: () => <p>login page</p> }));
vi.mock('@/auth/RegisterPage', () => ({ default: () => <p>register page</p> }));

import App from '@/App';

let path = '';
function PathProbe() {
  const { pathname } = useLocation();
  useEffect(() => {
    path = pathname;
  }, [pathname]);
  return null;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PathProbe />
      <App />
    </MemoryRouter>,
  );
}

const ENTRY = [
  ['/', 'landing page'],
  ['/login', 'login page'],
  ['/register', 'register page'],
] as const;
const registered = { id: 'u1', username: 'ada', is_guest: false };
const guest = { id: 'g1', username: 'guest_ab12', is_guest: true };

describe('RequireVisitor', () => {
  afterEach(cleanup);

  it.each(ENTRY)('sends a signed-in user from %s to the dashboard', (entry, text) => {
    session.value = { ...session.value, user: registered, restoring: false };
    renderAt(entry);
    expect(screen.getByText('dashboard page')).toBeTruthy();
    expect(screen.queryByText(text)).toBeNull();
    expect(path).toBe('/dashboard');
  });

  it.each(ENTRY)('shows only a hidden placeholder on %s while restoring', (entry, text) => {
    session.value = { ...session.value, user: registered, restoring: true };
    const { container } = renderAt(entry);
    expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByText('dashboard page')).toBeNull();
    expect(container.querySelector('.sd-route-skeleton[aria-hidden="true"]')).not.toBeNull();
    expect(path).toBe(entry);
  });

  it.each(ENTRY)('renders %s for a settled visitor', (entry, text) => {
    session.value = { ...session.value, user: null, restoring: false };
    renderAt(entry);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('sends a guest away from the landing and login pages', () => {
    session.value = { ...session.value, user: guest, restoring: false };
    renderAt('/login');
    expect(path).toBe('/dashboard');
  });

  it('keeps /register open to a guest so the account upgrade still works', () => {
    session.value = { ...session.value, user: guest, restoring: false };
    renderAt('/register');
    expect(screen.getByText('register page')).toBeTruthy();
  });
});