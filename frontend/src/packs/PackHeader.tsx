import { useEffect, useState } from 'react'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import type { Pack } from '../types/api'
import '../styles/packs.css'
import { SampleChip } from './PackChip'
import { packLabel } from './packView'

/** "Pack N of M" with the pack's points, for the floor map header. Renders nothing for a non-pack dungeon or when packs are off. */
export function PackHeader({ dungeonId }: { dungeonId: string }) {
  const [state, setState] = useState<{ pack: Pack; total: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        if (capabilityOf(api, 'packs') === 'off') return
        const res = await api.getPacks()
        const pack = res.packs.find((p) => p.dungeon_id === dungeonId)
        if (!cancelled && pack) setState({ pack, total: res.packs.length })
      } catch {
        // No pack header without pack data.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dungeonId])
  if (!state) return null
  return (
    <div className="sd-pack__header" data-testid="pack-header">
      <span>{packLabel(state.pack, state.total)}</span>
      <span>{`${state.pack.points_earned} points`}</span>
      {state.pack.sample && <SampleChip />}
    </div>
  )
}
