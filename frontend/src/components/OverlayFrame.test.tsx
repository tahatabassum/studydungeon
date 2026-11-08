import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverlayFrame } from './OverlayFrame'

function Overlay({ onEscape }: { onEscape?: () => void }) {
  return (
    <OverlayFrame title="Test" titleId="t-title" onEscape={onEscape}>
      <button>One</button>
      <button>Two</button>
    </OverlayFrame>
  )
}

describe('OverlayFrame', () => {
  afterEach(cleanup)

  it('focuses the first control, exposes a labelled dialog and cycles Tab', () => {
    render(<Overlay />)
    const dialog = screen.getByRole('dialog', { name: 'Test' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const one = screen.getByRole('button', { name: 'One' })
    const two = screen.getByRole('button', { name: 'Two' })
    expect(document.activeElement).toBe(one)
    two.focus()
    fireEvent.keyDown(two, { key: 'Tab' })
    expect(document.activeElement).toBe(one)
    fireEvent.keyDown(one, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(two)
  })

  it('returns focus to the game container on unmount', () => {
    const game = document.createElement('div')
    game.setAttribute('role', 'application')
    game.tabIndex = 0
    document.body.appendChild(game)
    const { unmount } = render(<Overlay />)
    unmount()
    expect(document.activeElement).toBe(game)
    game.remove()
  })

  it('calls onEscape only when provided', () => {
    const onEscape = vi.fn()
    const { unmount } = render(<Overlay onEscape={onEscape} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
    unmount()
    render(<Overlay />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
