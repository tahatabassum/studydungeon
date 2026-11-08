import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../api/client'
import { readFlags } from '../config/flags'
import { defineContractSuite } from './suite'

const flags = readFlags()
const enabled = flags.apiBaseUrl !== '' && !flags.useMocks

if (enabled) {
  defineContractSuite({
    label: `Http_Client at ${flags.apiBaseUrl}`,
    makeClient: () => createHttpClient(flags.apiBaseUrl),
  })
} else {
  describe.skip('contract: Http_Client (skipped: set VITE_API_BASE_URL and VITE_USE_MOCKS=false to run)', () => {
    it('is skipped without a real backend', () => {
      expect(enabled).toBe(true)
    })
  })
}
