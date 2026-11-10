import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { getApi, supportsPracticeModes } from '../api'
import type { Floor } from '../types/api'
import '../styles/haunt.css'
import { ModePicker } from './ModePicker'

export interface ModePickerButtonProps {
  dungeonId: string | null
  floors: readonly Floor[]
}

/**
 * Opens the mode picker. Where the backend has no run modes (real mode, the offline demo) it shows an
 * honest "coming soon" line instead of a button that would fail (D26).
 */
export function ModePickerButton({ dungeonId, floors }: ModePickerButtonProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void getApi().then((api) => {
      if (!cancelled) setSupported(supportsPracticeModes(api))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (supported === null) return null
  if (!supported) {
    return (
      <div className="sd-haunt" data-testid="modes-unsupported">
        <button type="button" className="sd-ghost-btn" aria-disabled="true" aria-describedby="modes-soon">
          <Swords aria-hidden="true" size={16} />
          Practice modes
        </button>
        <p id="modes-soon" className="sd-haunt__meta">
          Coming soon: Weak Topics, Exam and Replay Floor need support from the backend.
        </p>
      </div>
    )
  }
  return (
    <>
      <button type="button" className="sd-ghost-btn" data-testid="open-modes" onClick={() => setOpen(true)} disabled={!dungeonId}>
        <Swords aria-hidden="true" size={16} />
        Practice modes
      </button>
      {open && dungeonId && (
        <ModePicker
          dungeonId={dungeonId}
          floors={floors}
          onClose={() => setOpen(false)}
          onStart={(path) => {
            setOpen(false)
            navigate(path)
          }}
        />
      )}
    </>
  )
}
