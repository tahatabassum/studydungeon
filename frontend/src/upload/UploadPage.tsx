import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { getApi } from '../api'
import { PageShell } from '../components/PageShell'
import { useSession } from '../state/SessionContext'
import { UploadWizard } from './UploadWizard'

export const GUEST_UPLOAD_TEXT = 'Create an account to upload your own notes'

export interface UploadPageProps {
  /** Status poll interval in ms (tests use a short one). */
  pollMs?: number
}

/** `/upload`: the wizard for signed-in players. Guests (and visitors) see a sign-up prompt instead. */
export default function UploadPage({ pollMs }: UploadPageProps = {}) {
  const { user, restoring } = useSession()
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        if (!cancelled) setSupported(api.capabilities?.uploads !== false)
      } catch {
        // Keep the wizard; a failing request shows its own message.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const gated = !user || user.is_guest

  return (
    <PageShell
      variant="fit"
      testId="upload-page"
      title="Upload your notes"
      subtitle="Turn your own notes into a dungeon"
      back={{ to: '/dashboard', label: 'Dashboard' }}
    >
      {restoring && !user ? (
        <p className="sd-card__muted" role="status">
          Checking your session...
        </p>
      ) : gated ? (
        <section className="sd-card" aria-labelledby="up-guest-title" data-testid="upload-guest">
          <h2 id="up-guest-title" className="sd-card__h">
            <UserPlus aria-hidden="true" size={18} />
            Accounts only
          </h2>
          <p className="sd-card__text">{GUEST_UPLOAD_TEXT}</p>
          <p className="sd-card__muted">Guests can play the demo dungeon. Uploads are saved to an account.</p>
          <div>
            <Link to="/register" className="sd-cta">
              <UserPlus aria-hidden="true" size={18} />
              Create an account
            </Link>
          </div>
        </section>
      ) : !supported ? (
        <section className="sd-card" data-testid="upload-unavailable">
          <p className="sd-card__text">Uploading notes needs a connection to the server. It is not available in the offline demo.</p>
        </section>
      ) : (
        <UploadWizard {...(pollMs !== undefined ? { pollMs } : {})} />
      )}
    </PageShell>
  )
}
