import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import '../styles/auth.css'
import { getApi } from '../api'
import { useSession } from '../state/SessionContext'
import { StoneFrame } from '../components/StoneFrame'
import { PixelSprite } from '../components/PixelSprite'
import { CHARACTER_SPRITES } from '../art/sprites'
import { mapAuthError, type AuthMode } from './errors'
import { useRetryAfter } from './useRetryAfter'
import { loginErrors, registerErrors, type FieldErrors } from './validation'

const COPY = {
  login: {
    heading: 'Return to the crypt',
    blurb: 'Log in to pick up your progress.',
    submit: 'Log in',
    busy: 'Opening the gate...',
    switchText: 'No account yet?',
    switchLabel: 'Create one',
    switchTo: '/register',
    passwordHint: undefined,
    autoComplete: 'current-password',
  },
  register: {
    heading: 'Join the haunt',
    blurb: 'Create an account to keep your progress and a place on the board.',
    submit: 'Create account',
    busy: 'Carving your name...',
    switchText: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: '/login',
    passwordHint: 'At least 8 characters.',
    autoComplete: 'new-password',
  },
} as const

/**
 * The shared Login/Register form: exactly two fields (username and password), a show/hide control,
 * field-level messages and friendly status errors. The session is the httpOnly cookie, so nothing here
 * touches localStorage or sessionStorage.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode]
  const navigate = useNavigate()
  const { setUser } = useSession()
  const retry = useRetryAfter()
  const ids = { user: useId(), pass: useId(), userErr: useId(), passErr: useId(), hint: useId() }
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const blocked = retry.remaining > 0

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || blocked) return
    const found = mode === 'login' ? loginErrors(username, password) : registerErrors(username, password)
    setErrors(found)
    setStatus(null)
    if (found.username) {
      userRef.current?.focus()
      return
    }
    if (found.password) {
      passRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const api = await getApi()
      const credentials = { username: username.trim(), password }
      const user = mode === 'login' ? await api.login(credentials) : await api.register(credentials)
      setUser(user)
      navigate('/dashboard')
    } catch (err) {
      const view = mapAuthError(err, mode)
      setErrors(view.fields)
      setStatus(view.message)
      if (view.retryAfter !== undefined) retry.start(view.retryAfter)
      else if (view.fields.username) userRef.current?.focus()
      else if (view.fields.password) passRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <StoneFrame className="sd-auth" data-testid={`${mode}-card`}>
      <div className="sd-auth__body">
        <PixelSprite
          map={mode === 'login' ? CHARACTER_SPRITES.haunted_portrait : CHARACTER_SPRITES.friendly_ghost}
          scale={3}
          className="sd-auth__sprite"
        />
        <h2 className="sd-auth__heading">{copy.heading}</h2>
        <p className="sd-auth__blurb">{copy.blurb}</p>

        <form className="sd-auth__form" onSubmit={(e) => void onSubmit(e)} noValidate aria-label={copy.submit}>
          <div className="sd-auth__field">
            <label htmlFor={ids.user}>Username</label>
            <input
              ref={userRef}
              id={ids.user}
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={errors.username ? true : undefined}
              aria-describedby={errors.username ? ids.userErr : undefined}
            />
            {errors.username && (
              <p id={ids.userErr} className="sd-auth__error">
                {errors.username}
              </p>
            )}
          </div>

          <div className="sd-auth__field">
            <label htmlFor={ids.pass}>Password</label>
            <div className="sd-auth__password">
              <input
                ref={passRef}
                id={ids.pass}
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete={copy.autoComplete}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? ids.passErr : copy.passwordHint ? ids.hint : undefined}
              />
              <button
                type="button"
                className="sd-auth__toggle"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </div>
            {errors.password ? (
              <p id={ids.passErr} className="sd-auth__error">
                {errors.password}
              </p>
            ) : (
              copy.passwordHint && (
                <p id={ids.hint} className="sd-auth__hint">
                  {copy.passwordHint}
                </p>
              )
            )}
          </div>

          <div role="status" aria-live="polite" className="sd-auth__status">
            {status && <p className="sd-auth__error sd-auth__error--status">{status}</p>}
            {blocked && <p className="sd-auth__hint">You can try again in {retry.remaining}s.</p>}
          </div>

          <button type="submit" className="sd-cta sd-auth__submit" disabled={busy || blocked} aria-busy={busy || undefined}>
            {mode === 'login' ? <LogIn aria-hidden="true" size={18} /> : <UserPlus aria-hidden="true" size={18} />}
            {busy ? copy.busy : blocked ? `Wait ${retry.remaining}s` : copy.submit}
          </button>
        </form>

        <p className="sd-auth__switch">
          {copy.switchText} <Link to={copy.switchTo}>{copy.switchLabel}</Link>
        </p>
      </div>
    </StoneFrame>
  )
}
