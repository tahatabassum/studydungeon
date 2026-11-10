import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { parseFloorCount, parseStatusMode } from './DevFloors'
import { DEV_FLOORS_PATH, devFloorsRoute } from './devRoute'

describe('/dev/floors route (D11)', () => {
  it('is registered in development and shows the requested fixture', async () => {
    render(
      <MemoryRouter initialEntries={[`${DEV_FLOORS_PATH}?floors=10&status=mixed`]}>
        <Routes>{devFloorsRoute(true)}</Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Dev fixtures: 10 floors, status mixed/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your notes became 10 floors')
    expect(screen.getByTestId('final-boss-node')).toBeTruthy()
  })

  it('is absent when DEV is false: no route element and nothing renders', () => {
    expect(devFloorsRoute(false)).toBeNull()
    const { container } = render(
      <MemoryRouter initialEntries={[DEV_FLOORS_PATH]}>
        <Routes>{devFloorsRoute(false)}</Routes>
      </MemoryRouter>,
    )
    expect(container.textContent).not.toContain('Floor fixtures')
  })

  it('parses the query: only 1, 3, 10 and 25 floors; unknown values fall back', () => {
    expect([1, 3, 10, 25].map((n) => parseFloorCount(String(n)))).toEqual([1, 3, 10, 25])
    expect(parseFloorCount('7')).toBe(3)
    expect(parseFloorCount(null)).toBe(3)
    expect(parseStatusMode('failed')).toBe('failed')
    expect(parseStatusMode('nope')).toBe('mixed')
  })
})
