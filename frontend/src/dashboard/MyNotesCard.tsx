import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileQuestion, Trash2 } from 'lucide-react'
import { describeError, getApi } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import type { StoredDocument } from '../types/api'

const STATUS_LABEL: Record<StoredDocument['status'], string> = {
  processing: 'Reading...',
  accepted: 'Ready',
  rejected: 'Rejected',
  failed: 'Failed',
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; docs: StoredDocument[] } | { state: 'hidden' }

/**
 * My Notes: the player's stored documents with a link to each summoned dungeon and a Delete button. Deleting
 * frees a stored slot (the server also removes the note's dungeon). Hidden when the client has no document list.
 */
export function MyNotesCard() {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [confirming, setConfirming] = useState<StoredDocument | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Bumped by Retry; each value loads the list once (late answers from an older load are dropped).
  const [loadKey, setLoadKey] = useState(0)
  const refresh = useCallback(() => {
    setLoad({ state: 'loading' })
    setLoadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const api = await getApi()
      let next: Load
      if (!api.listDocuments) {
        next = { state: 'hidden' }
      } else {
        try {
          next = { state: 'ready', docs: await api.listDocuments() }
        } catch (err) {
          next = { state: 'error', message: describeError(err, 'Your notes could not be loaded.') }
        }
      }
      if (!cancelled) setLoad(next)
    })()
    return () => {
      cancelled = true
    }
  }, [loadKey])

  const remove = async (doc: StoredDocument) => {
    setConfirming(null)
    setBusyId(doc.id)
    setDeleteError(null)
    try {
      const api = await getApi()
      await api.deleteDocument?.(doc.id)
      setLoad((prev) => (prev.state === 'ready' ? { state: 'ready', docs: prev.docs.filter((d) => d.id !== doc.id) } : prev))
    } catch (err) {
      setDeleteError(describeError(err, 'That note could not be deleted.'))
    } finally {
      setBusyId(null)
    }
  }

  if (load.state === 'hidden') return null

  return (
    <section className="sd-card sd-notes" aria-labelledby="dash-notes" data-testid="my-notes">
      <h2 id="dash-notes" className="sd-card__h">
        <BookOpen aria-hidden="true" size={18} />
        My notes
      </h2>
      {load.state === 'loading' && <p className="sd-card__muted">Gathering your notes...</p>}
      {load.state === 'error' && (
        <div role="alert" className="sd-notes__error">
          <p className="sd-card__muted">{load.message}</p>
          <button type="button" className="sd-ghost-btn" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      {load.state === 'ready' && load.docs.length === 0 && (
        <EmptyState
          icon={FileQuestion}
          title="No notes yet"
          message={
            <>
              <Link to="/upload">Upload your notes</Link> to summon your own dungeon.
            </>
          }
          testId="my-notes-empty"
        />
      )}
      {load.state === 'ready' && load.docs.length > 0 && (
        <ul className="sd-notes__list">
          {load.docs.map((doc) => (
            <li key={doc.id} className="sd-notes__item" data-testid="my-notes-item">
              <span className="sd-notes__title" title={doc.title}>
                {doc.title}
              </span>
              <span className="sd-notes__status" data-status={doc.status}>
                {STATUS_LABEL[doc.status]}
              </span>
              <span className="sd-notes__actions">
                {doc.dungeon_id && (
                  <Link to={`/campaign/${encodeURIComponent(doc.dungeon_id)}`} className="sd-ghost-btn">
                    Play
                  </Link>
                )}
                <button
                  type="button"
                  className="sd-ghost-btn"
                  onClick={() => setConfirming(doc)}
                  disabled={busyId === doc.id}
                  aria-label={`Delete ${doc.title}`}
                >
                  <Trash2 aria-hidden="true" size={14} />
                  {busyId === doc.id ? 'Deleting...' : 'Delete'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {deleteError && (
        <p role="alert" className="sd-card__muted">
          {deleteError}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this note?"
          message={`"${confirming.title}" and the dungeon summoned from it will be deleted. Your points and level stay.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          onConfirm={() => void remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  )
}