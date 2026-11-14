import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api'
import { ApiError, friendlyMessage } from '../api/errors'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import { useSession } from '../state/SessionContext'
import { resetClientCaches } from '../state/resetClientCaches'
import '../styles/live.css'

/** The confirmation word. The match is exact: case-sensitive, no trimming ("delete" and "DELETE " do not count). */
export const DELETE_WORD = 'DELETE'

export const DELETE_REMOVES: readonly string[] = [
  'Your name and handle',
  'Your Leaderboard points and board entries',
  'Your runs and scores',
  'Your review schedule',
  'Your uploaded notes and the dungeons made from them',
]

const GENERIC_ERROR = 'The account could not be deleted. Nothing was removed. Check your connection and try again.'

export interface DeleteAccountDialogProps {
  onClose(): void
}

/** D12: type DELETE, then `DELETE /auth/me`. Success clears the session and caches and opens the title screen. */
export function DeleteAccountDialog({ onClose }: DeleteAccountDialogProps) {
  const navigate = useNavigate()
  const { clearSession } = useSession()
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ready = typed === DELETE_WORD

  function signedOut() {
    clearSession()
    resetClientCaches()
    navigate('/', { replace: true })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || pending) return
    setPending(true)
    setError(null)
    try {
      const api = await getApi()
      await api.deleteAccount()
      signedOut()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // The session is already gone on the server: treat the player as signed out.
        signedOut()
        return
      }
      const message =
        err instanceof ApiError && (err.status === 403 || err.status === 422)
          ? (friendlyMessage(err.code, err.status) ?? err.message)
          : GENERIC_ERROR
      setError(message)
      setPending(false)
    }
  }

  return (
    <OverlayFrame
      title="Delete my account and data"
      titleId="delete-title"
      role="alertdialog"
      describedBy="delete-desc"
      initialFocus={inputRef}
      onEscape={() => {
        if (!pending) onClose()
      }}
      zClass="z-[60]"
      widthClass="max-w-md"
    >
      <form onSubmit={(e) => void submit(e)} className="sd-live__form w-full text-left" data-testid="delete-dialog">
        <p id="delete-desc">This cannot be undone. These are removed for good:</p>
        <ul className="list-disc pl-5" data-testid="delete-removes">
          {DELETE_REMOVES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <label htmlFor="delete-confirm" className="sd-live__label">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          ref={inputRef}
          className="sd-live__input"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={pending}
        />
        {error && (
          <p role="alert" className="sd-live__error" data-testid="delete-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3 font-(family-name:--font-label)">
          <Button variant="primary" onClick={onClose} disabled={pending} data-cancel>
            Cancel
          </Button>
          <Button variant="secondary" type="submit" disabled={!ready} loading={pending} data-testid="delete-confirm-button">
            Delete everything
          </Button>
        </div>
      </form>
    </OverlayFrame>
  )
}
