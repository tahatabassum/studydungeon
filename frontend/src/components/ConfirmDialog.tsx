import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from './Button'

export interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm(): void
  onCancel(): void
}

/** Confirmation dialog (Req 10.5, 10.8). Focus starts on Cancel; Esc cancels. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button[data-cancel]')?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('button')
    if (!buttons || buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border-2 border-amber bg-panel p-8 text-center">
        <h2 id="confirm-title" className="text-2xl font-bold text-parchment">
          {title}
        </h2>
        <p id="confirm-desc" className="text-parchment">
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={onCancel} data-cancel>
            {cancelLabel}
          </Button>
          <Button variant="secondary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
