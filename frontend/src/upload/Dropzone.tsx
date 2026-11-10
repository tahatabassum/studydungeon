import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { FileUp } from 'lucide-react'
import { useTouchMode } from '@/touch/useTouchMode'
import { ACCEPT_ATTR, FORMATS_TEXT, LIMITS_TEXT, PHOTO_HINT } from './limits'

export interface DropzoneProps {
  disabled?: boolean
  onFile(file: File, extra: number): void
}

/** Rune seal drawn in SVG: a ring, a star and a quill-less scroll. Decorative only. */
function RuneSeal() {
  return (
    <svg className="sd-up__seal" viewBox="0 0 96 96" width="72" height="72" aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="48" cy="48" r="32" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M48 22 L54 42 L74 42 L58 54 L64 74 L48 62 L32 74 L38 54 L22 42 L42 42 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Drag and drop plus a file picker. The picker is a real file input inside a label, so Tab reaches it and
 * Enter or Space opens the chooser. One file at a time: extra dropped files are counted, not uploaded.
 */
export function Dropzone({ disabled = false, onFile }: DropzoneProps) {
  const [over, setOver] = useState(false)
  const hintId = useId()
  const touch = useTouchMode()

  const take = (files: FileList | null | undefined) => {
    const first = files?.[0]
    if (first) onFile(first, Math.max(0, (files?.length ?? 1) - 1))
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (!disabled) take(e.dataTransfer?.files)
  }
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    take(e.target.files)
    // Allows picking the same file again after removing it.
    e.target.value = ''
  }

  return (
    <div
      className="sd-up__drop"
      data-over={over ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-testid="dropzone"
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <RuneSeal />
      {touch ? (
        <p className="sd-up__drop-title">Tap to choose a file</p>
      ) : (
        <>
          <p className="sd-up__drop-title">Drop your notes here</p>
          <p className="sd-card__muted">or</p>
        </>
      )}
      <label className="sd-ghost-btn sd-up__pick">
        <FileUp aria-hidden="true" size={16} />
        Choose a file
        <input
          type="file"
          className="sd-up__input"
          accept={ACCEPT_ATTR}
          disabled={disabled}
          onChange={onPick}
          aria-describedby={hintId}
        />
      </label>
      <p id={hintId} className="sd-card__muted sd-up__formats">
        {FORMATS_TEXT} {LIMITS_TEXT}
      </p>
      <p className="sd-card__muted sd-up__formats">{PHOTO_HINT}</p>
    </div>
  )
}
