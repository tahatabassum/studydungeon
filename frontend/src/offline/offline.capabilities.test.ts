import { describe, expect, it } from 'vitest'
import { capabilityOf } from '../api/ApiClient'
import { createAdapter } from './adapter'

const make = () => createAdapter({ now: () => 0, nextId: (p) => `${p}-1` })

describe('Offline_Demo capabilities for frontend-10', () => {
  it('turns every live-player capability off', () => {
    const api = make()
    for (const key of [
      'guestIdentity',
      'accountUpgrade',
      'accountDelete',
      'packs',
      'liveBoard',
      'playerCounter',
      'uploadQuota',
      'guestUpload',
    ] as const) {
      expect(capabilityOf(api, key), key).toBe('off')
    }
  })

  it('rejects the identity calls with 501', async () => {
    const api = make()
    await expect(api.checkGuestName('Ada')).rejects.toMatchObject({ status: 501 })
    await expect(api.listDungeons()).rejects.toMatchObject({ status: 501 })
  })
})
