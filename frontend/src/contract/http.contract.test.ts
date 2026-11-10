import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../api/client'
import { readFlags } from '../config/flags'
import { createCookieFetch } from './cookieFetch'
import { defineContractSuite } from './suite'

/**
 * Runs the shared suite against the REAL backend when VITE_API_BASE (or VITE_API_BASE_URL) is set and
 * VITE_USE_MOCKS is not 'true'. The suite asserts DOMAIN shapes: the client has already mapped the wire.
 * Example (backend on http://localhost:8000):
 *   $env:VITE_API_BASE='http://localhost:8000'; $env:VITE_USE_MOCKS='false'; npm.cmd run test:contract
 */
const flags = readFlags()
const enabled = flags.apiBaseUrl !== '' && !flags.useMocks

if (enabled) {
  defineContractSuite({
    label: `Http_Client at ${flags.apiBaseUrl}`,
    makeClient: () => createHttpClient(flags.apiBaseUrl, createCookieFetch()),
  })
} else {
  describe.skip('contract: Http_Client (skipped: set VITE_API_BASE and VITE_USE_MOCKS=false to run)', () => {
    it('is skipped without a real backend', () => {
      expect(enabled).toBe(true)
    })
  })
}
