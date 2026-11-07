import { describe, expect, it } from 'vitest'
import { debugRequested, rendererFromSearch } from './rendererQuery'

describe('query switches', () => {
  it('renderer=canvas forces canvas, anything else is auto', () => {
    expect(rendererFromSearch('?renderer=canvas')).toBe('canvas')
    expect(rendererFromSearch('?renderer=webgl')).toBe('auto')
    expect(rendererFromSearch('')).toBe('auto')
  })

  it('debug=1 enables the overlay', () => {
    expect(debugRequested('?debug=1')).toBe(true)
    expect(debugRequested('?debug=0')).toBe(false)
    expect(debugRequested('')).toBe(false)
  })
})
