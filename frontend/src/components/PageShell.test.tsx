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

  it('center adds sd-fit--center on fit only', () => {
    render(
      <MemoryRouter>
        <PageShell title="T" testId="c" variant="fit" center>
          <p>x</p>
        </PageShell>
        <PageShell title="S" testId="s" center>
          <p>y</p>
        </PageShell>
        <PageShell title="N" testId="n" variant="fit">
          <p>z</p>
        </PageShell>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('c').className).toContain('sd-fit--center')
    expect(screen.getByTestId('s').className).not.toContain('sd-fit--center')
    expect(screen.getByTestId('n').className).not.toContain('sd-fit--center')
  })
  it('renders the back link once and the body exists', () => {
    render(
      <MemoryRouter>
        <PageShell title="T" variant="fit" back={{ to: '/dashboard', label: 'Dashboard' }}>
          <p>x</p>
        </PageShell>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: /Dashboard/ })).toHaveLength(1)
    expect(screen.getByTestId('page-body')).toBeTruthy()
  })
})
