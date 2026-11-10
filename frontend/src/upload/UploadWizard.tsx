import { useState } from 'react'
import { AlertTriangle, FileText, RefreshCw, Sparkles, Upload, X } from 'lucide-react'
import '../styles/campaign.css'
import '../styles/dashboard.css'
import '../styles/upload.css'
import { useReducedMotion } from '../state/useReducedMotion'
import { Dropzone } from './Dropzone'
import { formatSize } from './limits'
import { StepList } from './StepList'
import { SummonResult } from './SummonResult'
import { announcementFor, stepStates } from './steps'
import { useUploadFlow, type UseUploadFlowOptions } from './useUploadFlow'

/** The upload wizard: pick a file, watch the five steps, see the verdict and the topics, summon the floors. */
export function UploadWizard(options: UseUploadFlowOptions = {}) {
  const flow = useUploadFlow(options)
  const reduced = useReducedMotion()
  const [extra, setExtra] = useState(0)
  const { phase, file } = flow

  const picking = phase === 'idle'
  const staged = phase === 'staged' || phase === 'uploading' || phase === 'error'
  const canRemove = phase === 'staged' || phase === 'error'
  const live = announcementFor(phase, {
    floors: flow.dungeon?.floors?.length ?? 1,
    topics: flow.topics.length,
    reason: flow.reason,
    error: flow.error,
  })

  return (
    <div className="sd-up" data-phase={phase} data-reduced={reduced ? 'true' : undefined} data-testid="upload-wizard">
      <StepList states={stepStates(phase)} />

      {picking && (
        <Dropzone
          onFile={(f, more) => {
            setExtra(more)
            flow.stage(f)
          }}
        />
      )}

      {staged && file && (
        <section className="sd-card sd-up__file" aria-label="Chosen file" data-testid="staged-file">
          <div className="sd-up__file-row">
            <FileText aria-hidden="true" size={20} />
            <span className="sd-up__file-name">{file.name}</span>
            <span className="sd-card__muted">{formatSize(file.size)}</span>
          </div>
          {extra > 0 && <p className="sd-card__muted">Only one file at a time. The first one was used.</p>}
          {flow.hint && (
            <p className="sd-up__hint" data-testid="file-hint">
              <AlertTriangle aria-hidden="true" size={14} />
              {`${flow.hint} The server makes the final call.`}
            </p>
          )}
          {flow.error && (
            <p role="alert" className="sd-up__error" data-testid="upload-error">
              {flow.error}
            </p>
          )}
          <div className="sd-dash__actions">
            <button
              type="button"
              className="sd-cta"
              onClick={flow.start}
              disabled={phase === 'uploading'}
              aria-busy={phase === 'uploading' || undefined}
            >
              <Upload aria-hidden="true" size={18} />
              {phase === 'error' ? 'Try again' : 'Upload notes'}
            </button>
            {canRemove && (
              <button type="button" className="sd-ghost-btn" onClick={flow.clear}>
                <X aria-hidden="true" size={16} />
                Choose another file
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'processing' && (
        <section className="sd-card" aria-label="Reading" data-testid="upload-processing">
          <p className="sd-card__text">The crypt keeper is reading your notes. This usually takes a few seconds.</p>
          {flow.slow && (
            <p className="sd-card__muted" role="status">
              This is taking longer than usual.{' '}
              <button type="button" className="sd-link-btn" onClick={flow.checkAgain}>
                Check again
              </button>
            </p>
          )}
        </section>
      )}

      {(phase === 'rejected' || phase === 'failed') && (
        <section className="sd-card sd-card--alert" aria-labelledby="up-verdict-title" data-testid="upload-verdict">
          <h2 id="up-verdict-title" className="sd-card__h">
            <AlertTriangle aria-hidden="true" size={18} />
            {phase === 'rejected' ? 'These notes were rejected' : 'These notes could not be read'}
          </h2>
          <p role="alert" className="sd-card__text" data-testid="rejection-reason">
            {flow.reason ?? 'The server gave no reason.'}
          </p>
          {flow.error && (
            <p role="alert" className="sd-up__error">
              {flow.error}
            </p>
          )}
          <div className="sd-dash__actions">
            <button type="button" className="sd-ghost-btn" onClick={flow.retry}>
              <RefreshCw aria-hidden="true" size={16} />
              Check again
            </button>
            <button type="button" className="sd-cta" onClick={flow.clear}>
              Choose another file
            </button>
          </div>
        </section>
      )}

      {(phase === 'accepted' || phase === 'summoning') && (
        <section className="sd-card" aria-labelledby="up-topics-title" data-testid="upload-topics">
          <h2 id="up-topics-title" className="sd-card__h">
            <Sparkles aria-hidden="true" size={18} />
            {`Topics found (${flow.topics.length})`}
          </h2>
          {flow.topics.length === 0 ? (
            <p className="sd-card__muted">No topics were listed for this document.</p>
          ) : (
            <ul className="sd-up__topics">
              {flow.topics.map((t) => (
                <li key={t.id}>
                  <span className="sd-up__topic-name">{t.name}</span>
                  {t.description && <span className="sd-card__muted">{t.description}</span>}
                </li>
              ))}
            </ul>
          )}
          {flow.error && (
            <p role="alert" className="sd-up__error" data-testid="summon-error">
              {flow.error}
            </p>
          )}
          <div>
            <button
              type="button"
              className="sd-cta"
              onClick={flow.summon}
              disabled={phase === 'summoning'}
              aria-busy={phase === 'summoning' || undefined}
            >
              <Sparkles aria-hidden="true" size={18} />
              Summon dungeon
            </button>
          </div>
        </section>
      )}

      {phase === 'done' && flow.dungeon && <SummonResult dungeon={flow.dungeon} />}

      <div role="status" aria-live="polite" className="sr-only" data-testid="upload-live">
        {live}
      </div>
    </div>
  )
}
