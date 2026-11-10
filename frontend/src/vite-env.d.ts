/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCKS?: string
  readonly VITE_MOCK_SEED_REVENANTS?: string
  /** Dev only: extra ms on the mock demo session, to see the "Waking up the dungeon..." loader. */
  readonly VITE_MOCK_DELAY_MS?: string
  readonly VITE_BADGE_SPEED_READER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
