/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCKS?: string
  /** 'true' runs the contract suite against VITE_API_BASE (a real, disposable backend). */
  readonly VITE_CONTRACT_LIVE?: string
  /** 'true' also runs the upload cases of the live contract suite (backend with AI_PROVIDER=mock only). */
  readonly VITE_CONTRACT_UPLOADS?: string
  readonly VITE_MOCK_SEED_REVENANTS?: string
  /** Dev only: extra ms on the mock demo session, to see the "Waking up the dungeon..." loader. */
  readonly VITE_MOCK_DELAY_MS?: string
  readonly VITE_MOCK_QUOTA?: string
  readonly VITE_MOCK_AI_BUSY?: string
  readonly VITE_BADGE_SPEED_READER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
