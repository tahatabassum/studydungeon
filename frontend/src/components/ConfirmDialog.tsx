import { Button } from './Button'
import { OverlayFrame } from './OverlayFrame'

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
  return (
    <OverlayFrame
      title={title}
      titleId="confirm-title"
      role="alertdialog"
      describedBy="confirm-desc"
      initialFocus="button[data-cancel]"
      onEscape={onCancel}
      zClass="z-[60]"
      widthClass="max-w-sm"
    >
      <p id="confirm-desc" className="text-ink">
        {message}
      </p>
      <div className="flex flex-wrap justify-center gap-3 font-(family-name:--font-label)">
        <Button variant="primary" onClick={onCancel} data-cancel>
          {cancelLabel}
        </Button>
        <Button variant="secondary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </OverlayFrame>
  )
}
