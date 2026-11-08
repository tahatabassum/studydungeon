import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFEAT_CANDLES } from './fxCounts'

const rm = vi.hoisted(() => ({ reduced: false }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.reduced }
})

import { DefeatOverlay } from './DefeatOverlay'
import { PauseMenu } from './PauseMenu'

afterEach(() => {
  cleanup()
  rm.reduced = false
})

describe('DefeatOverlay', () => {
  it('shows a row of candles and focuses Retry', () => {
    render(<DefeatOverlay onRetry={() => {}} />)
    const row = screen.getByTestId('defeat-candles')
    expect(row.querySelectorAll('.sd-dcandle').length).toBe(DEFEAT_CANDLES)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }))
  })

  it('marks the dialog reduced so candles stay dim and static', () => {
    rm.reduced = true
    render(<DefeatOverlay onRetry={() => {}} />)
    expect(screen.getByRole('alertdialog').getAttribute('data-reduced')).toBe('true')
  })
})

describe('PauseMenu', () => {
  it('uses the same stone frame as the HUD', () => {
    render(<PauseMenu onResume={() => {}} onRestart={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Paused' })
    expect(dialog.querySelector('.sd-stone')).not.toBeNull()
  })
})
