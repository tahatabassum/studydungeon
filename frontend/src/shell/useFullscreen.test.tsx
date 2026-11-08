import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/AppShell'
import { FullscreenButton } from '@/components/FullscreenButton'
import { FULLSCREEN_FAILED_MESSAGE, isTypingTarget, useFullscreen } from './useFullscreen'

function Harness() {
  const fs = useFullscreen()
  return (
    <AppShell announcement={fs.message}>
      <FullscreenButton isFullscreen={fs.isFullscreen} onToggle={() => void fs.toggle()} />
      <input aria-label="name" />
    </AppShell>
  )
}

function mockFullscreen(impl: () => Promise<void>) {
  const request = vi.fn(impl)
  Object.defineProperty(document.documentElement, 'requestFullscreen', { value: request, configurable: true })
  return request
}

afterEach(() => {
  cleanup()
  delete (document.documentElement as unknown as Record<string, unknown>).requestFullscreen
})

describe('fullscreen toggle', () => {
  it('requests fullscreen from the button and from the F key', async () => {
    const request = mockFullscreen(() => Promise.resolve())
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /enter fullscreen/i }))
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f' })
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('shell-live').textContent).toBe('')
  })

  it('does not toggle while typing in an input or with a modifier key', async () => {
    const request = mockFullscreen(() => Promise.resolve())
    render(<Harness />)
    const input = screen.getByLabelText('name')
    input.focus()
    await act(async () => {
      fireEvent.keyDown(input, { key: 'f' })
    })
    expect(request).not.toHaveBeenCalled()
    input.blur()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps the layout and announces a message when the request is rejected', async () => {
    const request = mockFullscreen(() => Promise.reject(new Error('denied')))
    render(<Harness />)
    const shellBefore = screen.getByTestId('themed-backdrop')
    await userEvent.click(screen.getByRole('button', { name: /enter fullscreen/i }))
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('shell-live').textContent).toBe(FULLSCREEN_FAILED_MESSAGE)
    expect(screen.getByTestId('themed-backdrop')).toBe(shellBefore)
    expect(screen.getByRole('button', { name: /enter fullscreen/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('announces a message when the browser has no fullscreen support', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /enter fullscreen/i }))
    expect(screen.getByTestId('shell-live').textContent).toBe(FULLSCREEN_FAILED_MESSAGE)
  })

  it('isTypingTarget recognises form fields only', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
