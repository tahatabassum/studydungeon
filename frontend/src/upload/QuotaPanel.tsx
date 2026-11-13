import { Hourglass } from 'lucide-react'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import type { UploadQuota } from '../types/api'
import { PreloadedFallback } from './PreloadedFallback'
import { quotaView } from './quotaView'

export interface QuotaPanelProps {
  quota: UploadQuota
}

/** Shows what is left today. A blocked quota offers the preloaded dungeons (and an account for a guest at the limit). */
export function QuotaPanel({ quota }: QuotaPanelProps) {
  const view = quotaView(quota)
  return (
    <section className="sd-up__quota" aria-label="Upload allowance" data-testid="quota-panel" data-allowed={view.allowed ? 'true' : 'false'}>
      <p className="sd-up__chip" data-allowed={view.allowed ? 'true' : 'false'} role={view.allowed ? undefined : 'status'}>
        <Hourglass aria-hidden="true" size={16} />
        <span>{view.line}</span>
      </p>
      {!view.allowed && (
        <div className="sd-dash__actions">
          {view.offerPacks && <PreloadedFallback />}
          {view.offerAccount && <UpgradeOffer isGuest look="secondary" className="sd-ghost-btn" />}
        </div>
      )}
    </section>
  )
}
