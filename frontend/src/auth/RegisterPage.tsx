import { PageShell } from '../components/PageShell'
import { AuthForm } from './AuthForm'

/** `/register`: pick a name and a password, then the Dashboard. */
export default function RegisterPage() {
  return (
    <PageShell variant="fit" testId="register-page" title="Create account" subtitle="Save your progress and climb the board" back={{ to: '/', label: 'Title screen' }}>
      <AuthForm mode="register" />
    </PageShell>
  )
}
