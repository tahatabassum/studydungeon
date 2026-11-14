import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { useSession } from '../state/SessionContext'
import type { UploadQuota } from '../types/api'
import { AiNotice } from './AiNotice'
import { QuotaPanel } from './QuotaPanel'
import { quotaView } from './quotaView'
import { UploadWizard } from './UploadWizard'

export const GUEST_UPLOAD_TEXT = 'Create an account to upload your own notes'

export interface UploadPageProps {
  /** Status poll interval in ms (tests use a short one). */
  pollMs?: number
}

type Access = 'checking' | 'wizard' | 'gate' | 'offline'

/**
 * `/upload`. Registered players get the wizard. A guest gets it too when guest upload is not off and the quota
 * answers (frontend-10 D22); otherwise (no session, guest upload off, quota failed for a guest) the sign-up gate.
 */
export default function UploadPage({ pollMs }: UploadPageProps = {}) {
  const { user, restoring } = useSession()
  /** The answer is kept with the user it was computed for, so a new user starts at 'checking' without a state reset. */
  const [answer, setAnswer] = useState<{ key: string; access: Access }>({ key: '', access: 'checking' })
  const userKey = user ? `:` : ''
  const [quota, setQuota] = useState<UploadQuota | null>(null)
  const [accepted, setAccepted] = useState(false)

  const loadQuota = useCallback(async (): Promise<UploadQuota | null> => {
    try {
      const api = await getApi()
      if (capabilityOf(api, 'uploadQuota') === 'off') return null
      const q = await api.getUploadQuota()
      setQuota(q)
      return q
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const setAccess = (next: Access) => setAnswer({ key: userKey, access: next })
    void (async () => {
      try {
        const api = await getApi()
        if (api.capabilities?.uploads === false) {
          if (!cancelled) setAccess('offline')
          return
        }
        if (user.is_guest) {
          if (capabilityOf(api, 'guestUpload') === 'off') {
            if (!cancelled) setAccess('gate')
            return
          }
          // A guest needs a quota answer; a failed quota request falls back to the gate text.
          const q = await loadQuota()
          if (!cancelled) setAccess(q !== null && capabilityOf(api, 'guestUpload') !== 'off' ? 'wizard' : 'gate')
          return
        }
        await loadQuota()
        if (!cancelled) setAccess('wizard')
      } catch {
        // Keep the wizard for a registered player; a failing request shows its own message.
        if (!cancelled) setAccess(user.is_guest ? 'gate' : 'wizard')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, userKey, loadQuota])

  const access: Access = !user ? 'gate' : answer.key === userKey ? answer.access : 'checking'
  const view = quota ? quotaView(quota) : null
  const blocked = view !== null && !view.allowed

  return (
    <PageShell
      variant="fit"
      className="sd-haunted sd-upload"
      decor={<HauntedBackdrop />}
      testId="upload-page"
      title="Upload your notes"
      subtitle="Turn your own notes into a dungeon"
      back={{ to: '/dashboard', label: 'Dashboard' }}
    >
      {(restoring && !user) || access === 'checking' ? (
        <p className="sd-card__muted" role="status">
          Checking your session...
        </p>
      ) : access === 'gate' ? (
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
      ) : access === 'offline' ? (
        <section className="sd-card" data-testid="upload-unavailable">
          <p className="sd-card__text">Uploading notes needs a connection to the server. It is not available in the offline demo.</p>
        </section>
      ) : (
        <UploadWizard
          {...(pollMs !== undefined ? { pollMs } : {})}
          noticeAccepted={accepted}
          blocked={blocked}
          {...(blocked && view ? { blockedReason: view.line } : {})}
          onSent={() => void loadQuota()}
          intro={
            <>
              {quota && <QuotaPanel quota={quota} />}
              <AiNotice accepted={accepted} onChange={setAccepted} disabled={blocked} />
            </>
          }
        />
      )}
    </PageShell>
  )
}
