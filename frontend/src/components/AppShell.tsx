import type { ReactNode } from 'react'
import { ThemedBackdrop } from './ThemedBackdrop'
import '../styles/shell.css'

export interface AppShellProps {
  children: ReactNode
  /** Short message announced politely to assistive technology (e.g. a rejected fullscreen request). */
  announcement?: string
}

/** Full-viewport shell (100dvh x 100dvw, safe-area aware): themed backdrop, stage children, live region. */
export function AppShell({ children, announcement = '' }: AppShellProps) {
  return (
    <main className="sd-shell">
      <ThemedBackdrop />
      {children}
      <div role="status" aria-live="polite" data-testid="shell-live" className="sr-only">
        {announcement}
      </div>
    </main>
  )
}
