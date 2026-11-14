import { useState } from 'react'
import { LogOut, Trash2 } from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { Button } from '../components/Button'
import { DeleteAccountDialog } from '../identity/DeleteAccountDialog'
import { displayHandle } from '../identity/handle'
import { useSession } from '../state/SessionContext'
import { useLogout } from '../state/useLogout'
import { useReducedMotion } from '../state/useReducedMotion'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import '../styles/live.css'
import '../styles/haunted.css'

/** `/settings` (RequireSession): who you are, how sound and motion work, log out, and delete the account. */
export default function SettingsPage() {
  const { user } = useSession()
  const { loggingOut, logOut } = useLogout()
  const reduced = useReducedMotion()
  const [deleting, setDeleting] = useState(false)
  const registered = !!user && !user.is_guest

  return (
    <PageShell
      variant="fit" center
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="settings-page"
      title="Settings"
      back={{ to: '/dashboard', label: 'Dashboard' }}
    >
      <div className="sd-live__body sd-live__body--wide sd-settings">
        <div className="sd-settings__cards">
        <section className="sd-card" aria-labelledby="set-account">
          <h2 id="set-account" className="sd-card__h">
            Account
          </h2>
          <p data-testid="settings-handle">{`Playing as ${displayHandle(user)}`}</p>
          {registered && user?.username && (
            <p className="sd-live__note" data-testid="settings-username">
              {`Login name: ${user.username} (private, only you see this)`}
            </p>
          )}
        </section>

        <section className="sd-card" aria-labelledby="set-sound">
          <h2 id="set-sound" className="sd-card__h">
            Sound and motion
          </h2>
          <p className="sd-card__muted">Sound is muted or unmuted with the speaker button inside a dungeon run.</p>
          <p className="sd-card__muted" data-testid="settings-motion">
            {`Reduced motion follows your device setting. It is currently ${reduced ? 'on' : 'off'}.`}
          </p>
        </section>
        </div>

        <div className="sd-dash__actions">
          {registered && (
            <Button variant="secondary" onClick={() => void logOut()} disabled={loggingOut} data-testid="settings-logout">
              <LogOut aria-hidden="true" size={16} />
              Log out
            </Button>
          )}
          <Button variant="secondary" onClick={() => setDeleting(true)} data-testid="settings-delete">
            <Trash2 aria-hidden="true" size={16} />
            Delete my account and data
          </Button>
        </div>
      </div>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </PageShell>
  )
}
