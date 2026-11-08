import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { PORTRAIT_KINDS, portraitFor } from '@/art/portraits/types'
import { entrySide } from './entrySide'
import { keyToOption } from './keys'
import { linesFor, pickLine } from './lines'

describe('Property 5: Entry side alternates', () => {
  /** **Validates: Requirements 4.2** */
  it('entrySide(n) differs from entrySide(n + 1) and is stable', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        expect(entrySide(n)).not.toBe(entrySide(n + 1))
        expect(entrySide(n)).toBe(entrySide(n))
      }),
    )
  })

  it('the boss enters from the right', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), (n) => {
        expect(entrySide(n, true)).toBe('right')
      }),
    )
  })
})

describe('Property 6: Number keys map to options', () => {
  /** **Validates: Requirements 4.5** */
  it('returns options[k - 1] for digit k within range, else null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 6 }),
        fc.oneof(
          fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Enter', ' ', 'a', '10', ''),
          fc.string(),
        ),
        (options, key) => {
          const got = keyToOption(key, options)
          const k = /^[1-9]$/.test(key) ? Number(key) : 0
          if (k >= 1 && k <= options.length) expect(got).toBe(options[k - 1])
          else expect(got).toBeNull()
        },
      ),
    )
  })
})

describe('Property 7: Characters and lines have fallbacks and bounded counts', () => {
  /** **Validates: Requirements 5.3, 5.4, 5.5, 5.6** */
  it('portraitFor always returns a registered character; unknown kinds are the Skeleton', () => {
    fc.assert(
      fc.property(fc.string(), (kind) => {
        const p = portraitFor(kind)
        expect(PORTRAIT_KINDS).toContain(p)
      }),
    )
    expect(portraitFor('definitely_not_a_kind')).toBe('skeleton')
    expect(portraitFor('__proto__')).toBe('skeleton')
    expect(portraitFor('paper_wraith')).toBe('ghost')
    expect(portraitFor('toxic_slime')).toBe('witch')
    expect(portraitFor('gear_golem')).toBe('golem')
    expect(portraitFor('memory_eater')).toBe('vampire')
    expect(portraitFor('exam_warden')).toBe('warden')
  })

  it('linesFor returns 3 to 5 taunts and reactions for any kind', () => {
    fc.assert(
      fc.property(fc.string(), (kind) => {
        const l = linesFor(kind)
        expect(l.taunts.length).toBeGreaterThanOrEqual(3)
        expect(l.taunts.length).toBeLessThanOrEqual(5)
        expect(l.reactions.length).toBeGreaterThanOrEqual(3)
        expect(l.reactions.length).toBeLessThanOrEqual(5)
      }),
    )
  })

  it('pickLine returns a member of the list for any integer seed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer(),
        (list, seed) => {
          expect(list).toContain(pickLine(list, seed))
        },
      ),
    )
  })
})
