import { describe, expect, it } from 'vitest'
import { ENDPOINT_SCHEMAS } from '../../schemas'
import { FIXTURES } from './index'

describe('mock fixtures', () => {
  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s satisfies its endpoint schema', (_name, f) => {
    const parsed = ENDPOINT_SCHEMAS[f.key].schema.safeParse(f.data)
    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true)
    // Fixtures carry no keys the schema would strip.
    if (parsed.success) expect(parsed.data).toEqual(f.data)
  })
})
