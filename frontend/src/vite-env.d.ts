/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCKS?: string
  readonly VITE_MOCK_SEED_REVENANTS?: string
  readonly VITE_BADGE_SPEED_READER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
