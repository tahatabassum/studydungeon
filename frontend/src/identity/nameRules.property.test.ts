import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { checkLocalName } from './nameRules'

/** Independent reference model: returns 'ok' with the normalized name, or the first broken rule. */
type Model = { ok: true; name: string } | { ok: false; reason: 'too_short' | 'too_long' | 'characters' }

const isAlnum = (c: string) => /^[A-Za-z0-9]$/.test(c)

function model(raw: string): Model {
  const name = raw.trim().normalize('NFKC')
  const chars = Array.from(name)
  if (name.length < 3) return { ok: false, reason: 'too_short' }
  if (name.length > 16) return { ok: false, reason: 'too_long' }
  if (!isAlnum(name[0]) || !isAlnum(name[name.length - 1])) return { ok: false, reason: 'characters' }
  if (!chars.every((c) => isAlnum(c) || c === ' ' || c === '_' || c === '-')) {
    return { ok: false, reason: 'characters' }
  }
  if (name.includes('  ')) return { ok: false, reason: 'characters' }
  return { ok: true, name }
}

const alnum = fc.constantFrom(...'abcXYZ019'.split(''))
const inner = fc.constantFrom(...'abZ09 _-'.split(''))

// Valid names: alnum edges, 1-14 inner chars, no double space.
const validName = fc
  .tuple(alnum, fc.array(inner, { minLength: 1, maxLength: 14 }), alnum)
  .map(([a, mid, b]) => a + mid.join('') + b)
  .filter((s) => !s.includes('  '))

const tooShort = fc.string({ minLength: 0, maxLength: 2 })
const tooLong = fc.array(alnum, { minLength: 17, maxLength: 30 }).map((a) => a.join(''))
const badEdge = fc
  .tuple(fc.constantFrom('_', '-', ' ', '!'), validName)
  .map(([c, s]) => (c === ' ' ? '_' + s : c + s))
const badChar = fc
  .tuple(alnum, alnum, fc.constantFrom('!', '.', '@', 'é', '日', '😀'), alnum)
  .map(([a, b, c, d]) => a + b + c + d)
const doubleSpace = fc.tuple(alnum, alnum, alnum).map(([a, b, c]) => `${a}${b}  ${c}`)
const padded = fc.tuple(fc.constantFrom('', ' ', '\t', '\n'), validName, fc.constantFrom('', ' ', '  ')).map(([l, s, r]) => l + s + r)
const fullwidth = fc.constantFrom('Ａｌｉｃｅ', 'ｂｏｂ１２３', 'ＡＢ', 'ａ　ｂ')

const anyName = fc.oneof(
  validName,
  tooShort,
  tooLong,
  badEdge,
  badChar,
  doubleSpace,
  padded,
  fullwidth,
  fc.string({ maxLength: 24 }),
  fc.string({ unit: 'binary', maxLength: 24 }),
  fc.string({ unit: 'grapheme', maxLength: 24 }),
)

describe('Feature: frontend-10-live-players, Property 1: Local name hints match the rule model', () => {
  it('Feature: frontend-10-live-players, Property 1: ok and first broken rule agree with the model', () => {
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(anyName, (raw) => {
        const actual = checkLocalName(raw)
        const expected = model(raw)
        expect(actual.ok).toBe(expected.ok)
        if (expected.ok && actual.ok) {
          expect(actual.name).toBe(expected.name)
        } else if (!expected.ok && !actual.ok) {
          expect(actual.reason).toBe(expected.reason)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('Feature: frontend-10-live-players, Property 1: generated valid names are accepted', () => {
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(validName, (raw) => checkLocalName(raw).ok === true),
      { numRuns: 200 },
    )
  })

  it('Feature: frontend-10-live-players, Property 1: each rule-breaking family is rejected with its reason', () => {
    // **Validates: Requirements 2.6**
    const cases: Array<[fc.Arbitrary<string>, string]> = [
      [tooShort.filter((s) => s.trim().normalize('NFKC').length < 3), 'too_short'],
      [tooLong, 'too_long'],
      [badEdge.filter((s) => s.trim().length <= 16), 'characters'],
      [badChar, 'characters'],
      [doubleSpace, 'characters'],
    ]
    for (const [arb, reason] of cases) {
      fc.assert(
        fc.property(arb, (raw) => {
          const r = checkLocalName(raw)
          return !r.ok && r.reason === reason
        }),
        { numRuns: 100 },
      )
    }
  })
})
