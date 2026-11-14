import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { displayHandle } from './handle'

// Feature: frontend-10-live-players, Property 3: Handle display never leaks a guest username
// **Validates: Requirements 3.3, 3.4, 3.5**

const maybeText = fc.option(
  fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.string({ maxLength: 12 }),
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,9}$/),
  ),
  { nil: undefined },
)
const guestUsername = fc.stringMatching(/^guest_[0-9a-f]{8}$/)
const username = fc.oneof(guestUsername, fc.stringMatching(/^[a-z]{3,10}$/), fc.constant(''))

const has = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

const userArb = fc.record({
  username,
  is_guest: fc.boolean(),
  handle: maybeText,
  display_name: maybeText,
  tag: maybeText,
})

describe('Property 3: Handle display never leaks a guest username', () => {
  it('follows D10 precedence and never leaks a guest username', () => {
    fc.assert(
      fc.property(userArb, (u) => {
        const out = displayHandle(u as never)

        // never empty
        expect(out.trim()).not.toBe('')

        // exact precedence: handle > display_name#tag > display_name > (registered) username > "Guest"
        let expected: string
        if (has(u.handle)) expected = u.handle
        else if (has(u.display_name)) expected = has(u.tag) ? `${u.display_name}#${u.tag}` : u.display_name
        else if (!u.is_guest && has(u.username)) expected = u.username
        else expected = 'Guest'
        expect(out).toBe(expected)

        // guest: username only appears if the backend sent that same text as handle/display_name/tag
        if (u.is_guest && has(u.username)) {
          const sent = [u.handle, u.display_name, u.tag].filter(has)
          const sentContains = sent.some((s) => s.includes(u.username))
          const guestWord = 'Guest'.includes(u.username)
          if (!sentContains && !guestWord) {
            expect(out.includes(u.username)).toBe(false)
          }
        }
      }),
      { numRuns: 300 },
    )
  })

  it('guest with only a guest_xxxxxxxx username shows "Guest"', () => {
    fc.assert(
      fc.property(guestUsername, (name) => {
        expect(displayHandle({ username: name, is_guest: true } as never)).toBe('Guest')
        expect(displayHandle({ username: name, is_guest: true, handle: '', display_name: ' ', tag: 'ab' } as never)).toBe('Guest')
      }),
      { numRuns: 100 },
    )
  })

  it('null/undefined user shows "Guest"', () => {
    expect(displayHandle(null)).toBe('Guest')
    expect(displayHandle(undefined)).toBe('Guest')
  })
})
