import { describe, expect, it } from 'vitest'
import { shouldUseMocks } from './index'

describe('shouldUseMocks', () => {
  it('is true only for the exact string "true"', () => {
    expect(shouldUseMocks({ VITE_USE_MOCKS: 'true' })).toBe(true)
    expect(shouldUseMocks({ VITE_USE_MOCKS: 'false' })).toBe(false)
    expect(shouldUseMocks({ VITE_USE_MOCKS: 'TRUE' })).toBe(false)
    expect(shouldUseMocks({ VITE_USE_MOCKS: '1' })).toBe(false)
    expect(shouldUseMocks({ VITE_USE_MOCKS: '' })).toBe(false)
    expect(shouldUseMocks({})).toBe(false)
  })
})
