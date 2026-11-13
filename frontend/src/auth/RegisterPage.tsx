import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { useUpgradeAvailable } from '../identity/useUpgradeAvailable'
import { useSession } from '../state/SessionContext'
import { AuthForm } from './AuthForm'

/**
 * `/register`: pick a name and a password, then the Dashboard. A Guest with accountUpgrade on upgrades in place
 * (POST /auth/upgrade) and keeps the handle; everyone else gets the normal register flow (D11).
 */
export default function RegisterPage() {
  const { user } = useSession()
  const available = useUpgradeAvailable()
  const upgrade = !!user?.is_guest && available
  return (
    <PageShell
      variant="fit" center
      className="sd-haunted"
      decor={<HauntedBackdrop />}
      testId="register-page"
      title="Create account"
      subtitle={upgrade ? 'Your handle stays the same' : 'Save your progress and climb the board'}
      back={{ to: '/', label: 'Title screen' }}
    >
      <AuthForm mode="register" upgrade={upgrade} />
    </PageShell>
  )
}
