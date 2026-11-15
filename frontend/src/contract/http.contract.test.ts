// @vitest-environment node
// Node's own fetch, FormData and File: jsdom's FormData is not serialised by Node's fetch, so multipart uploads
// to a real backend arrived without their fields (422). Nothing in this file needs a DOM.
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
 * Add $env:VITE_CONTRACT_UPLOADS='true' to also run the document and upload cases. Only do that against a
 * backend started with AI_PROVIDER=mock: those cases upload files and would spend a real AI quota otherwise.
 */
const flags = readFlags()
const enabled = flags.apiBaseUrl !== '' && !flags.useMocks
const uploads = import.meta.env.VITE_CONTRACT_UPLOADS === 'true'

if (enabled) {
  defineContractSuite({
    label: `Http_Client at ${flags.apiBaseUrl}`,
    makeClient: () => createHttpClient(flags.apiBaseUrl, createCookieFetch()),
    // Own cookie jar per client. The identity cases create and delete accounts: DISPOSABLE backend only.
    makeFreshClient: () => createHttpClient(flags.apiBaseUrl, createCookieFetch()),
    uploads,
  })
} else {
  describe.skip('contract: Http_Client (skipped: set VITE_API_BASE and VITE_USE_MOCKS=false to run)', () => {
    it('is skipped without a real backend', () => {
      expect(enabled).toBe(true)
    })
  })
}
