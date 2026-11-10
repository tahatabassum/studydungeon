import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BADGES } from '../badges/badges'
import { buildPostText, SHARE_HASHTAG, type ShareData } from './postText'

const data: fc.Arbitrary<ShareData> = fc.record({
  score: fc.oneof(fc.integer({ min: -10, max: 1_000_000 }), fc.double({ noNaN: false })),
  rank: fc.option(fc.oneof(fc.integer({ min: -5, max: 5000 }), fc.constant(Number.NaN)), { nil: undefined }),
  badges: fc.array(fc.oneof(fc.constantFrom(...BADGES.map((b) => b.id)), fc.string()), { maxLength: 10 }),
  dungeonName: fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.constant(''), fc.constant('\n  #Hash \t'), fc.constantFrom('Cafe', 'Noten und Notizen', 'Ghostly notes', 'caf\u00e9 \u4e16\u754c')),
  floorRank: fc.option(fc.constantFrom('S', 'A', 'B', 'C'), { nil: undefined }),
})

describe('Property 21: Share post text', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 21: Share post text
  // **Validates: Requirements 15.7**
  it('always starts with #KiroweenHackathon26, including empty badges and Unicode names', () => {
    fc.assert(
      fc.property(data, (d) => {
        expect(buildPostText(d).startsWith('#KiroweenHackathon26')).toBe(true)
        expect(buildPostText(d).startsWith(SHARE_HASHTAG)).toBe(true)
      }),
      { numRuns: 300 },
    )
  })

  it('keeps the dungeon name on one line and names only known badges', () => {
    const text = buildPostText({ score: 1200, rank: 3, badges: ['first_blood', 'nope'], dungeonName: 'Line one\nLine two' })
    expect(text.split('\n')[0]).toContain('Line one Line two')
    expect(text).toContain('Score 1200, rank #3.')
    expect(text).toContain('Badges: First Blood.')
    expect(text).not.toContain('nope')
  })

  it('omits the badge line when there are none', () => {
    expect(buildPostText({ score: 5, badges: [], dungeonName: 'Crypt' })).not.toContain('Badges:')
  })
})
