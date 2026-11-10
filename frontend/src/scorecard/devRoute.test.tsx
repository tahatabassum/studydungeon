import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DEV_SCORECARD_PATH, devScorecardRoute } from './devRoute'

describe('/dev/scorecard route', { timeout: 15000 }, () => {
  it('is registered in development and shows the sample Scorecard', async () => {
    render(
      <MemoryRouter initialEntries={[DEV_SCORECARD_PATH]}>
        <Routes>{devScorecardRoute(true)}</Routes>
      </MemoryRouter>,
    )
    // The page is a lazy chunk: allow its first import to take a while.
    expect(await screen.findByTestId('scorecard', {}, { timeout: 8000 })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: /falls!/ })).toBeTruthy()
  })

  it('shows the error case with Retry', async () => {
    render(
      <MemoryRouter initialEntries={[`${DEV_SCORECARD_PATH}?case=error`]}>
        <Routes>{devScorecardRoute(true)}</Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: 'Retry' }, { timeout: 8000 })).toBeTruthy()
  })

  it('is absent when DEV is false', () => {
    expect(devScorecardRoute(false)).toBeNull()
    const { container } = render(
      <MemoryRouter initialEntries={[DEV_SCORECARD_PATH]}>
        <Routes>{devScorecardRoute(false)}</Routes>
      </MemoryRouter>,
    )
    expect(container.textContent).toBe('')
  })
})
