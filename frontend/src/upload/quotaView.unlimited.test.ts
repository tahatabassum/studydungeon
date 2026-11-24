import { describe, expect, it } from 'vitest'
import type { UploadQuota } from '../types/api'
import { quotaView } from './quotaView'

const unlimited = (over: Partial<UploadQuota> = {}): UploadQuota => ({
  can_upload: true,
  reason: null,
  player: { is_guest: true, used_today: 7, limit_today: 0, stored: 12, stored_limit: 0, unlimited: true },
  ...over,
})

describe('quotaView without count limits', () => {
  it('allows the upload and says the uploads are unlimited, whatever was used', () => {
    const v = quotaView(unlimited())
    expect(v.allowed).toBe(true)
    expect(v.reason).toBeNull()
    expect(v.line).toBe('Unlimited uploads. Summon as many dungeons as you need.')
    expect(v.offerPacks).toBe(false)
  })

  it('still respects a server block (for example the AI being busy)', () => {
    const v = quotaView(unlimited({ can_upload: false, reason: 'ai_unavailable' }))
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe('ai_unavailable')
  })
})