import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SourceLine } from './SourceLine'

afterEach(cleanup)

describe('SourceLine', () => {
  it('shows the page when the source is present (mock mode)', () => {
    render(<SourceLine source={{ page: 3, chunk_id: 'c' }} explanation="Because." />)
    expect(screen.getByText('From your notes: page 3')).toBeTruthy()
    expect(screen.getByText('Because.')).toBeTruthy()
  })

  it('real mode: without a page it shows the evidence quote', () => {
    render(<SourceLine evidenceQuote="The ALU does the maths." explanation="Calculations." />)
    expect(screen.getByText('From your notes: "The ALU does the maths."')).toBeTruthy()
    expect(screen.queryByText(/page/)).toBeNull()
    expect(screen.getByText('Calculations.')).toBeTruthy()
  })

  it('renders nothing when there is nothing to cite', () => {
    const { container } = render(<SourceLine />)
    expect(container.firstChild).toBeNull()
  })

  it('prefers the page over the quote when both are given', () => {
    render(<SourceLine source={{ page: 1, chunk_id: 'c' }} evidenceQuote="quote" />)
    expect(screen.getByText('From your notes: page 1')).toBeTruthy()
    expect(screen.queryByText(/quote/)).toBeNull()
  })
})
