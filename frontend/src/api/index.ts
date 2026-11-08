import type { ApiClient } from './ApiClient'
import { readFlags } from '../config/flags'
import { createHttpClient } from './client'

export { ApiError } from './errors'
export { ContractError, describeError } from './ContractError'
export type { ApiClient } from './ApiClient'

export function shouldUseMocks(env: { VITE_USE_MOCKS?: string }): boolean {
  return env.VITE_USE_MOCKS === 'true'
}

let apiPromise: Promise<ApiClient> | null = null

/** Resolves the Api_Client once: mock adapter when VITE_USE_MOCKS is 'true', else HTTP. */
export function getApi(): Promise<ApiClient> {
  if (!apiPromise) {
    apiPromise = shouldUseMocks(import.meta.env)
      ? import('./mock/mockAdapter').then((m) => m.default)
      : Promise.resolve(createHttpClient(readFlags().apiBaseUrl))
  }
  return apiPromise
}
