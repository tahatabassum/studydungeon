import { useState } from 'react'
import { ControlsHint } from './ControlsHint'

export interface ControlsLegendProps {
  /** Compact (below 640 px): the legend collapses behind a toggle. */
  compact: boolean
}

/** Bottom controls legend floating over the stage; collapsible in compact mode. */
export function ControlsLegend({ compact }: ControlsLegendProps) {
  const [open, setOpen] = useState(false)

  if (!compact) {
    return (
      <div className="sd-hud-bottom">
        <div className="sd-legend">
          <ControlsHint className="justify-center" />
        </div>
      </div>
    )
  }

  return (
    <div className="sd-hud-bottom">
      <div className="sd-legend flex-col items-stretch gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="controls-legend"
          onClick={() => setOpen((o) => !o)}
          className="sd-control min-h-8 rounded-md px-2 text-xs font-semibold text-ink"
        >
          {open ? 'Hide controls' : 'Controls'}
        </button>
        <div id="controls-legend" hidden={!open}>
          <ControlsHint className="flex-wrap justify-center gap-y-1 whitespace-normal!" />
        </div>
      </div>
    </div>
  )
}
