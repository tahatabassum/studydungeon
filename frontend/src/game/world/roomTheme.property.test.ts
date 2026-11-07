import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { selectTheme, THEMES, type ThemeId } from './roomTheme'

// Feature: frontend-04-rpg-ui-combat-flow, Property 13: Theme selection is data-driven
// **Validates: Requirements 15.1, 15.2, 15.3**

const EXPECTED: Record<string, ThemeId> = {
  paper_wraith: 'library',
  toxic_slime: 'lab',
  gear_golem: 'workshop',
  memory_eater: 'crypt',
}
const KNOWN = Object.keys(EXPECTED)

const kindArb = fc.option(
  fc.oneof(fc.constantFrom(...KNOWN, 'exam_warden', 'toString', '__proto__'), fc.string()),
  { nil: undefined },
)

describe('Property 13: Theme selection is data-driven', () => {
  it('boss rooms always use the throne theme, whatever the kind', () => {
    fc.assert(
      fc.property(kindArb, (kind) => {
        expect(selectTheme(kind, true).id).toBe('throne')
      }),
      { numRuns: 100 },
    )
  })

  it('non-boss theme depends only on the kind: known kinds map, others get entry', () => {
    fc.assert(
      fc.property(kindArb, (kind) => {
        const expected = kind !== undefined && Object.hasOwn(EXPECTED, kind) ? EXPECTED[kind] : 'entry'
        expect(selectTheme(kind, false).id).toBe(expected)
      }),
      { numRuns: 100 },
    )
  })

  it('is deterministic and returns a registered theme', () => {
    fc.assert(
      fc.property(kindArb, fc.boolean(), (kind, boss) => {
        const a = selectTheme(kind, boss)
        expect(selectTheme(kind, boss)).toBe(a)
        expect(THEMES[a.id]).toBe(a)
      }),
      { numRuns: 100 },
    )
  })
})
