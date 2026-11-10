import type { ApiClient } from './ApiClient'
import { readFlags } from '../config/flags'
import { createHttpClient } from './client'

export { ApiError } from './errors'
export { ContractError, describeError } from './ContractError'
export type { ApiClient } from './ApiClient'
export { supportsPracticeModes } from './ApiClient'

export function shouldUseMocks(env: { VITE_USE_MOCKS?: string }): boolean {
  return env.VITE_USE_MOCKS === 'true'
}

let apiPromise: Promise<ApiClient> | null = null
let override: ApiClient | null = null
const listeners = new Set<() => void>()

/** Resolves the Api_Client once: mock adapter when VITE_USE_MOCKS is 'true', else HTTP. An override wins. */
export function getApi(): Promise<ApiClient> {
  if (override) return Promise.resolve(override)
  if (!apiPromise) {
    apiPromise = shouldUseMocks(import.meta.env)
      ? import('./mock/mockAdapter').then((m) => m.default)
      : Promise.resolve(createHttpClient(readFlags().apiBaseUrl))
  }
  return apiPromise
}

/**
 * Replaces the resolved client at runtime (null restores the normal one). The only caller is the explicit
 * Offline demo choice (D15); the shell then shows the "Offline demo" label.
 */
export function setApiOverride(client: ApiClient | null): void {
  override = client
  for (const notify of [...listeners]) notify()
}

/** True while an override (the Offline demo) is installed. */
export function isApiOverridden(): boolean {
  return override !== null
}

/** Subscribes to override changes (for `useSyncExternalStore`). Returns the unsubscribe function. */
export function subscribeApiOverride(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
