import { useState, type ReactNode } from 'react'
import { AlertTriangle, FileText, RefreshCw, Sparkles, Upload, X } from 'lucide-react'
import '../styles/campaign.css'
import '../styles/dashboard.css'
import '../styles/upload.css'
import { useReducedMotion } from '../state/useReducedMotion'
import { Dropzone } from './Dropzone'
import { FileRules } from './FileRules'
import { FloorProgressList } from './FloorProgressList'
import { PreloadedFallback } from './PreloadedFallback'
import { fileHint, formatSize } from './limits'
import { StepList } from './StepList'
import { SummonResult } from './SummonResult'
import { announcementFor, stepStates } from './steps'
import { useUploadFlow, type UseUploadFlowOptions } from './useUploadFlow'

export interface UploadWizardProps extends Omit<UseUploadFlowOptions, 'acceptAiNotice'> {
  /** The AI notice is ticked: the drop zone opens and uploads send accept_ai_notice=true. */
  noticeAccepted?: boolean
  /** The quota blocks uploads: the drop zone stays disabled. */
  blocked?: boolean
  blockedReason?: string
  /** Called after a file was sent (the page refreshes the quota). */
  onSent?: () => void
  /** The quota panel and the AI notice, shown in the left column while picking a file. */
  intro?: ReactNode
}

/** The upload wizard: pick a file, watch the five steps, see the verdict and the topics, summon the floors. */
export function UploadWizard({ noticeAccepted = false, blocked = false, blockedReason, onSent, intro, ...options }: UploadWizardProps = {}) {
  const flow = useUploadFlow({ ...options, acceptAiNotice: noticeAccepted, ...(onSent ? { onSent } : {}) })
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
      <div className="sd-up__grid">
        <aside className="sd-up__aside" aria-label="Allowance and rules">
          {picking && intro}
          <FileRules />
        </aside>
        <div className="sd-up__main">
          {picking && (
            <Dropzone
              disabled={blocked || !noticeAccepted}
              {...(blocked && blockedReason ? { disabledReason: blockedReason } : !noticeAccepted ? { disabledReason: 'Tick the notice to choose a file.' } : {})}
              onFile={(f, more) => {
                setExtra(more)
                flow.stage(f)
                // A file the browser can already see is wrong waits for the player; any other starts at once.
                if (fileHint(f) === null) flow.start(f)
              }}
            />
          )}

          {staged && file && (
            <section className="sd-card sd-up__panel sd-up__file" aria-label="Chosen file" data-testid="staged-file">
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
              {flow.busy && (
                <div data-testid="upload-busy">
                  <p className="sd-card__text">The summoning circle is busy. You can wait a moment and try again, or play now.</p>
                  <PreloadedFallback />
                </div>
              )}
              {phase === 'uploading' ? (
                <p className="sd-up__sending" data-testid="upload-sending">
                  <span aria-hidden="true" className="sd-up__sending-dot" />
                  Sending your notes...
                </p>
              ) : (
                // Only after a browser-side hint (the file is not sent on its own) or a failed send.
                <div className="sd-dash__actions">
                  <button type="button" className="sd-cta" onClick={() => flow.start()}>
                    <Upload aria-hidden="true" size={18} />
                    {phase === 'error' ? 'Try again' : 'Upload notes'}
                  </button>
                  {canRemove && (
                    <button type="button" className="sd-ghost-btn" onClick={flow.clear}>
                      <X aria-hidden="true" size={16} />
                      Try another file
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {phase === 'processing' && (
            <section className="sd-card sd-up__panel" aria-label="Reading" data-testid="upload-processing">
              {file && (
                <div className="sd-up__file-row">
                  <FileText aria-hidden="true" size={20} />
                  <span className="sd-up__file-name">{file.name}</span>
                  <span className="sd-card__muted">{formatSize(file.size)}</span>
                </div>
              )}
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
            <section className="sd-card sd-card--alert sd-up__panel" aria-labelledby="up-verdict-title" data-testid="upload-verdict">
              <h2 id="up-verdict-title" className="sd-card__h">
                <AlertTriangle aria-hidden="true" size={18} />
                {phase === 'rejected' ? 'These notes were rejected' : 'These notes could not be read'}
              </h2>
              {file && (
                <div className="sd-up__file-row">
                  <FileText aria-hidden="true" size={20} />
                  <span className="sd-up__file-name">{file.name}</span>
                  <span className="sd-card__muted">{formatSize(file.size)}</span>
                </div>
              )}
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
                  Try another file
                </button>
              </div>
            </section>
          )}

          {(phase === 'accepted' || phase === 'summoning') && (
            <section className="sd-card sd-up__panel" aria-labelledby="up-topics-title" data-testid="upload-topics">
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
              {flow.rankingNote && (
                <p className="sd-card__muted" data-testid="ranking-note">
                  {flow.rankingNote}
                </p>
              )}
              {phase === 'summoning' && flow.statusFloors.length > 0 && (
                <FloorProgressList floors={flow.statusFloors.map((f, i) => ({ id: f.id, index: i + 1, title: 'Summoning', status: f.status }))} />
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
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only" data-testid="upload-live">
        {live}
      </div>
    </div>
  )
}
