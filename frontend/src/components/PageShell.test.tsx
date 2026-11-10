import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { PageShell } from './PageShell'

afterEach(cleanup)

function renderShell(variant?: 'fit' | 'scroll') {
  return render(
    <MemoryRouter>
      <PageShell title="T" testId="shell" {...(variant ? { variant } : {})}>
        <p>content</p>
      </PageShell>
    </MemoryRouter>,
  )
}

describe('PageShell variants', () => {
  it('defaults to the scroll variant with the original markup', () => {
    renderShell()
    const root = screen.getByTestId('shell')
    expect(root.className).toBe('sd-page sd-sky')
    expect(root.getAttribute('data-variant')).toBeNull()
    expect(screen.queryByTestId('page-body')).toBeNull()
    expect(screen.queryByTestId('page-atmosphere')).toBeNull()
  })

  it('fit variant: marks the root, wraps children in a flexing body and keeps the decor in the atmosphere layer', () => {
    renderShell('fit')
    const root = screen.getByTestId('shell')
    expect(root.className).toContain('sd-page--fit')
    expect(screen.getByTestId('page-body').textContent).toBe('content')
    expect(screen.getByTestId('page-atmosphere').className).toBe('sd-page__atmosphere')
  })
})
