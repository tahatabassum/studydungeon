import type { PackStatus } from '../types/api'

const STATUS_TEXT: Readonly<Record<PackStatus, string>> = {
  locked: 'Locked',
  available: 'Available',
  in_progress: 'In progress',
  completed: 'Completed',
}

/** Status chip of a pack (text always shown, never color alone). */
export function PackChip({ status }: { status: PackStatus }) {
  return (
    <span className="sd-pack__chip" data-status={status} data-testid="pack-status">
      {STATUS_TEXT[status]}
    </span>
  )
}

/** Mock only: the pack is placeholder content. */
export function SampleChip() {
  return (
    <span className="sd-pack__chip sd-pack__chip--sample" data-testid="sample-chip">
      Sample content
    </span>
  )
}
