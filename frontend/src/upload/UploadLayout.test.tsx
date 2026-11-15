/**
 * Upload layout markup (jsdom has no layout, so these check text, roles and structure, not pixels).
 * **Validates: Requirements 8.3, 8.5, 9.3, 7.2, 10.5**
 */
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { UploadQuota } from '@/types/api'
import { AI_NOTICE_LABEL, AiNotice } from './AiNotice'
import { Dropzone } from './Dropzone'
import { FileRules, ruleLines } from './FileRules'
import { FORMAT_LABELS, PHOTO_HINT, UPLOAD_LIMITS } from './limits'
import { QuotaPanel } from './QuotaPanel'
import { StepList } from './StepList'
import { STEP_LABELS, stepStates } from './steps'
import { UploadWizard } from './UploadWizard'

afterEach(cleanup)

const quota = (used: number, limit: number): UploadQuota => ({
  can_upload: used < limit,
  reason: null,
  player: { is_guest: true, used_today: used, limit_today: limit, stored: 0, stored_limit: 5 },
})

function Notice() {
  const [on, setOn] = useState(false)
  return <AiNotice accepted={on} onChange={setOn} />
}

describe('upload layout markup', () => {
  it('FileRules lines come from the limits module', () => {
    render(<FileRules />)
    const rules = within(screen.getByTestId('file-rules'))
    expect(rules.getByText(`Formats: ${FORMAT_LABELS.join(', ')}`)).toBeTruthy()
    expect(rules.getByText(`Up to ${UPLOAD_LIMITS.maxMb} MB`)).toBeTruthy()
    expect(rules.getByText(PHOTO_HINT)).toBeTruthy()
    expect(ruleLines({ ...UPLOAD_LIMITS, maxMb: 7 })).toContain('Up to 7 MB')
  })

  it('clicking the notice label toggles the checkbox', () => {
    render(<Notice />)
    const box = screen.getByTestId('ai-notice-check') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(screen.getByText(AI_NOTICE_LABEL))
    expect(box.checked).toBe(true)
    expect(AI_NOTICE_LABEL).toBe('I understand and want to continue')
  })

  it('a locked drop zone shows its message inside the zone and is aria-disabled', () => {
    render(<Dropzone disabled disabledReason="Tick the notice to choose a file." onFile={() => {}} />)
    const zone = screen.getByTestId('dropzone')
    expect(zone.getAttribute('aria-disabled')).toBe('true')
    expect(within(zone).getByTestId('dropzone-reason').textContent).toContain('Tick the notice')
    expect((within(zone).getByLabelText(/choose a file/i) as HTMLInputElement).disabled).toBe(true)
  })

  it('the stepper has five items and marks the active one', () => {
    render(<StepList states={stepStates('processing')} />)
    const items = within(screen.getByTestId('upload-steps')).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(STEP_LABELS).toHaveLength(5)
    expect(items.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1)
    expect(items[1].getAttribute('aria-current')).toBe('step')
  })

  it('the quota chip uses the singular and plural forms', () => {
    const { unmount } = render(
      <MemoryRouter>
        <QuotaPanel quota={quota(0, 1)} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('quota-panel').textContent).toContain('1 upload left today (0 of 1 used).')
    unmount()
    render(
      <MemoryRouter>
        <QuotaPanel quota={quota(0, 3)} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('quota-panel').textContent).toContain('3 uploads left today (0 of 3 used).')
  })

  it('the wizard renders the same grid with or without intro content', () => {
    const grid = (el: HTMLElement) => [...el.querySelectorAll('.sd-up__grid, .sd-up__aside, .sd-up__main')].map((n) => n.className)
    const a = render(
      <MemoryRouter>
        <UploadWizard />
      </MemoryRouter>,
    )
    const without = grid(a.container)
    a.unmount()
    const b = render(
      <MemoryRouter>
        <UploadWizard intro={<p>intro</p>} />
      </MemoryRouter>,
    )
    expect(grid(b.container)).toEqual(without)
    expect(without).toEqual(['sd-up__grid', 'sd-up__aside', 'sd-up__main'])
  })
})
