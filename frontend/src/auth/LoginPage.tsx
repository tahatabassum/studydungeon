import { PageShell } from '../components/PageShell'
import { AuthForm } from './AuthForm'

/** `/login`: username and password, then the Dashboard. */
export default function LoginPage() {
  return (
    <PageShell variant="fit" testId="login-page" title="Log in" subtitle="Welcome back to StudyDungeon" back={{ to: '/', label: 'Title screen' }}>
      <AuthForm mode="login" />
    </PageShell>
  )
}
