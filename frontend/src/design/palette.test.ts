import { describe, expect, it } from 'vitest'
import { COLORS, type ColorName } from '@/game/colors'
import { contrastRatio } from './contrast'

// Vitest stubs CSS imports; read the stylesheet from disk through the runtime's built-in fs.
interface NodeRuntime {
  cwd(): string
  getBuiltinModule(id: string): { readFileSync(path: string, enc: string): string }
}
const nodeProcess = (globalThis as unknown as { process: NodeRuntime }).process
const css = nodeProcess
  .getBuiltinModule('node:fs')
  .readFileSync(`${nodeProcess.cwd()}/src/index.css`, 'utf8')

function cssValue(name: ColorName): number {
  const cssName = name.toLowerCase().replace('_', '-')
  const m = new RegExp(`--color-${cssName}:\\s*#([0-9a-fA-F]{6})\\s*;`).exec(css)
  if (!m) throw new Error(`token --color-${cssName} not found`)
  return parseInt(m[1], 16)
}

describe('palette parity', () => {
  it.each(Object.keys(COLORS) as ColorName[])('%s equals in index.css and colors.ts', (name) => {
    expect(cssValue(name)).toBe(COLORS[name])
  })
})

describe('Halloween palette contrast', () => {
  const pairs: Array<[string, number, number, number]> = [
    ['bone on bg', COLORS.BONE, COLORS.BG, 4.5],
    ['ink on bg', COLORS.INK, COLORS.BG, 4.5],
    ['pumpkin on bg', COLORS.PUMPKIN, COLORS.BG, 4.5],
    ['bg text on pumpkin button', COLORS.BG, COLORS.PUMPKIN, 4.5],
    ['ember on bg', COLORS.EMBER, COLORS.BG, 4.5],
    ['ghost on bg', COLORS.GHOST, COLORS.BG, 4.5],
    ['toxic on bg', COLORS.TOXIC, COLORS.BG, 4.5],
    ['magic (text and borders) on bg', COLORS.MAGIC, COLORS.BG, 3],
    ['magenta on bg', COLORS.MAGENTA, COLORS.BG, 3],
  ]
  it.each(pairs)('%s meets its minimum', (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min)
  })

  it('witch purple is documented as fills and glows only (below 3:1 on bg)', () => {
    expect(contrastRatio(COLORS.WITCH, COLORS.BG)).toBeLessThan(3.2)
  })
})

describe('Required text and UI pairs on component surfaces', () => {
  const surfaces: Array<[string, number]> = [
    ['bg', COLORS.BG],
    ['surface-2', COLORS.SURFACE_2],
    ['panel', COLORS.PANEL],
    ['deep', COLORS.DEEP],
  ]
  const textTokens: Array<[string, number]> = [
    ['ink', COLORS.INK],
    ['ink-muted', COLORS.INK_MUTED],
    ['gold', COLORS.GOLD],
    ['health', COLORS.HEALTH],
  ]
  const cases = surfaces.flatMap(([sn, sv]) => textTokens.map(([tn, tv]) => [`${tn} on ${sn}`, tv, sv] as const))
  // ink-muted on deep is only used for borders and hints on bg/panel; the others must meet 4.5:1 as text.
  it.each(cases.filter(([label]) => label !== 'ink-muted on deep'))('text %s is at least 4.5:1', (_l, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  // Components render danger and magic text as color-mix(token, ink N%) because the raw tokens are below 4.5:1.
  const mixInk = (c: number, inkPct: number): number => {
    const ch = (shift: number) =>
      Math.round(((c >> shift) & 255) * (1 - inkPct / 100) + ((COLORS.INK >> shift) & 255) * (inkPct / 100))
    return (ch(16) << 16) | (ch(8) << 8) | ch(0)
  }

  it('danger (45% ink) and magic (40% ink) text mixes are at least 4.5:1 on bg, surface-2 and panel', () => {
    for (const bg of [COLORS.BG, COLORS.SURFACE_2, COLORS.PANEL]) {
      expect(contrastRatio(mixInk(COLORS.DANGER, 45), bg), `danger on ${bg.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(mixInk(COLORS.MAGIC, 40), bg), `magic on ${bg.toString(16)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('parchment (spellbook) text uses bg on ink/bone at 4.5:1', () => {
    expect(contrastRatio(COLORS.BG, COLORS.INK)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.BG, COLORS.BONE)).toBeGreaterThanOrEqual(4.5)
  })

  // Phase 2 encounter: the speech panel is parchment (ink to bone, darkest corner tinted 22% ember).
  it('encounter speech panel text meets 4.5:1 on every parchment tone', () => {
    const tones = [COLORS.INK, COLORS.BONE, blend(COLORS.EMBER, COLORS.BONE, 22)]
    const darkDanger = blend(COLORS.BG, COLORS.DANGER, 45)
    const darkHealth = blend(COLORS.BG, COLORS.HEALTH, 70)
    for (const tone of tones) {
      expect(contrastRatio(COLORS.BG, tone), 'body text').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.DEEP, tone), 'name plate and speaker line').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(darkDanger, tone), 'incorrect text').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(darkHealth, tone), 'correct text').toBeGreaterThanOrEqual(4.5)
    }
  })

  it('encounter focus ring (deep) and number badge (ink on deep) meet their minimums on parchment', () => {
    for (const tone of [COLORS.INK, COLORS.BONE]) {
      expect(contrastRatio(COLORS.DEEP, tone)).toBeGreaterThanOrEqual(3)
    }
    expect(contrastRatio(COLORS.INK, COLORS.DEEP)).toBeGreaterThanOrEqual(4.5)
  })

  it('defines the encounter styles with a 55 percent scrim and a visible focus state', () => {
    const encounter = nodeProcess
      .getBuiltinModule('node:fs')
      .readFileSync(`${nodeProcess.cwd()}/src/styles/encounter.css`, 'utf8')
    expect(encounter).toMatch(/var\(--color-bg\) 55%/)
    expect(encounter).toMatch(/\.sd-answer:focus-visible/)
    expect(encounter).toMatch(/\.sd-speech:focus-visible/)
  })

  it('UI borders and glows (magic, pumpkin, magenta) are at least 3:1 on panel', () => {
    for (const c of [COLORS.MAGIC, COLORS.PUMPKIN, COLORS.MAGENTA]) {
      expect(contrastRatio(c, COLORS.PANEL)).toBeGreaterThanOrEqual(3)
    }
  })

  // Phase 1 premium shell: new text and component pairs.
  const blend = (fg: number, bg: number, fgPct: number): number => {
    const ch = (shift: number) =>
      Math.round(((fg >> shift) & 255) * (fgPct / 100) + ((bg >> shift) & 255) * (1 - fgPct / 100))
    return (ch(16) << 16) | (ch(8) << 8) | ch(0)
  }

  it('floating HUD surface (panel at 92%) keeps ink and ink-muted text at 4.5:1 even over a bright stage', () => {
    for (const stage of [COLORS.BG, COLORS.INK, 0xffffff]) {
      const surface = blend(COLORS.PANEL, stage, 92)
      expect(contrastRatio(COLORS.INK, surface), `ink over ${stage.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.INK_MUTED, surface), `ink-muted over ${stage.toString(16)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pressed and hover primary button text (bg on accent, brightness 110%) is at least 4.5:1', () => {
    const bright = (c: number): number => {
      const ch = (shift: number) => Math.min(255, Math.round(((c >> shift) & 255) * 1.1))
      return (ch(16) << 16) | (ch(8) << 8) | ch(0)
    }
    expect(contrastRatio(COLORS.BG, bright(COLORS.ACCENT))).toBeGreaterThanOrEqual(4.5)
  })

  it('focus ring (accent) is at least 3:1 on bg, panel, deep and the HUD surface', () => {
    for (const bg of [COLORS.BG, COLORS.PANEL, COLORS.DEEP, blend(COLORS.PANEL, COLORS.BG, 92)]) {
      expect(contrastRatio(COLORS.ACCENT, bg)).toBeGreaterThanOrEqual(3)
    }
  })

  it('secondary button hover (ink on deep) is at least 4.5:1', () => {
    expect(contrastRatio(COLORS.INK, COLORS.DEEP)).toBeGreaterThanOrEqual(4.5)
  })

  it('defines the layout tokens, HUD surface and shared control states', () => {
    for (const name of ['--sd-space-4', '--sd-text-md', '--sd-glow-accent', '--sd-elev-2', '--sd-hud-surface', '--sd-dur-base']) {
      expect(css, name).toContain(`${name}:`)
    }
    expect(css).toMatch(/\.sd-control:active/)
    expect(css).toMatch(/\.sd-control:focus-visible/)
  })

  // Floor map (frontend-08 Phase 2): text on the node plate (panel to surface-2) and on the page.
  it('floor map text meets 4.5:1 on the node plate and on the map background', () => {
    const plate = [COLORS.PANEL, COLORS.SURFACE_2, blend(COLORS.BG, COLORS.PANEL, 40)]
    const danger = mixInk(COLORS.DANGER, 45)
    const texts: Array<[string, number]> = [
      ['title (bone)', COLORS.BONE],
      ['meta (ink-muted)', COLORS.INK_MUTED],
      ['chip locked (ink-muted)', COLORS.INK_MUTED],
      ['chip ready (pumpkin)', COLORS.PUMPKIN],
      ['chip summoning (ghost)', COLORS.GHOST],
      ['chip failed (danger mix)', danger],
      ['chip cleared (toxic)', COLORS.TOXIC],
    ]
    for (const bg of plate) {
      for (const [name, fg] of texts) {
        expect(contrastRatio(fg, bg), `${name} on ${bg.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const [name, fg] of [
      ['header title (gold)', COLORS.GOLD],
      ['subtitle (ink-muted)', COLORS.INK_MUTED],
      ['hint (ink-muted)', COLORS.INK_MUTED],
    ] as const) {
      expect(contrastRatio(fg, COLORS.INDIGO), `${name} on indigo`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(fg, COLORS.BG), `${name} on bg`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('floor map controls and rank letters meet their minimums', () => {
    // Continue button: bg text on the pumpkin to ember gradient.
    expect(contrastRatio(COLORS.BG, COLORS.PUMPKIN)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.BG, COLORS.EMBER)).toBeGreaterThanOrEqual(4.5)
    // Rank letters sit on the bg-coloured seal badge.
    for (const c of [COLORS.GOLD, COLORS.TOXIC, COLORS.EMBER, COLORS.BONE]) {
      expect(contrastRatio(c, COLORS.BG)).toBeGreaterThanOrEqual(4.5)
    }
    // Floor number (bone) on the seal; seal rings and path strokes against the page are non-text graphics (3:1).
    expect(contrastRatio(COLORS.BONE, COLORS.SURFACE_2)).toBeGreaterThanOrEqual(4.5)
    for (const c of [COLORS.PUMPKIN, COLORS.EMBER, COLORS.GHOST, COLORS.BLOOD_RED]) {
      expect(contrastRatio(c, COLORS.BG), `ring ${c.toString(16)}`).toBeGreaterThanOrEqual(3)
    }
    // Retry button text on the transparent plate.
    expect(contrastRatio(COLORS.INK, COLORS.PANEL)).toBeGreaterThanOrEqual(4.5)
  })

  // Layout pass (horizontal floor map): topic rows in the card, "+N more" and its popover, the arrows and the toolbar row.
  it('horizontal floor map: topic rows, "+N more", popover, arrows and the toolbar row meet their minimums', () => {
    const card = [COLORS.PANEL, COLORS.SURFACE_2, blend(COLORS.BG, COLORS.PANEL, 40)]
    for (const bg of card) {
      const at = bg.toString(16)
      expect(contrastRatio(COLORS.INK, bg), `topic name (ink) on ${at}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.INK_MUTED, bg), `band text (ink-muted) on ${at}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.GOLD, bg), `+N more (gold) on ${at}`).toBeGreaterThanOrEqual(4.5)
      // The "+N more" pill border is a UI graphic (3:1).
      expect(contrastRatio(COLORS.GOLD, bg), `pill border on ${at}`).toBeGreaterThanOrEqual(3)
    }
    // Popover: ink and ink-muted on panel, accent border (graphic).
    expect(contrastRatio(COLORS.INK, COLORS.PANEL), 'popover text').toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.INK_MUTED, COLORS.PANEL), 'popover band text').toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.ACCENT, COLORS.PANEL), 'popover border and focus ring').toBeGreaterThanOrEqual(3)
    // "+N more" hover and open state: gold on deep.
    expect(contrastRatio(COLORS.GOLD, COLORS.DEEP), '+N more hovered').toBeGreaterThanOrEqual(4.5)
    // Prev and next arrows: ink icon on panel, hover on deep; accent border against the page.
    expect(contrastRatio(COLORS.INK, COLORS.PANEL), 'arrow icon').toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.INK, COLORS.DEEP), 'arrow icon hovered').toBeGreaterThanOrEqual(4.5)
    for (const bg of [COLORS.BG, COLORS.INDIGO]) {
      expect(contrastRatio(COLORS.ACCENT, bg), `arrow border on ${bg.toString(16)}`).toBeGreaterThanOrEqual(3)
    }
    // Toolbar row: panel at 70% over the page. Hint, memory info and streak sit on it; the title row sits on the bare page.
    for (const page of [COLORS.BG, COLORS.INDIGO]) {
      const bar = blend(COLORS.PANEL, page, 70)
      for (const [name, fg] of [
        ['hint and memory info (ink-muted)', COLORS.INK_MUTED],
        ['streak (gold)', COLORS.GOLD],
        ['Practice modes (ink)', COLORS.INK],
        ['celebration title (bone)', COLORS.BONE],
      ] as const) {
        expect(contrastRatio(fg, bar), `${name} on the toolbar over ${page.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    // Title screen and Dashboard links (ink-muted) and the sub line sit on the bare page; hover goes to ink.
    expect(contrastRatio(COLORS.INK_MUTED, COLORS.INDIGO)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.INK, COLORS.INDIGO)).toBeGreaterThanOrEqual(4.5)
  })

  // Phase 5 (frontend-07): Scorecard, Leaderboard and Dashboard text on their own surfaces.
  it('scorecard text meets 4.5:1 on its surfaces', () => {
    const hero = blend(COLORS.PUMPKIN, COLORS.PANEL, 14)
    const levelPill = blend(COLORS.GOLD, COLORS.PANEL, 14)
    const weaponCard = blend(COLORS.GOLD, COLORS.PANEL, 10)
    const pairs: Array<[string, number, number]> = [
      ['score number (gold) on the hero', COLORS.GOLD, hero],
      ['accuracy text (ink) on panel', COLORS.INK, COLORS.PANEL],
      ['label (ink-muted) on the hero', COLORS.INK_MUTED, hero],
      ['XP line (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['level-up pill (gold)', COLORS.GOLD, levelPill],
      ['weapon card (ink)', COLORS.INK, weaponCard],
      ['band Weak (danger mix) on panel', mixInk(COLORS.DANGER, 45), COLORS.PANEL],
      ['band Learning (ember) on panel', COLORS.EMBER, COLORS.PANEL],
      ['band Strong (toxic) on panel', COLORS.TOXIC, COLORS.PANEL],
      ['weak concept text (bg) on parchment ink', COLORS.BG, COLORS.INK],
      ['weak concept heading (deep) on parchment bone', COLORS.DEEP, COLORS.BONE],
      ['share tooltip (ink) on bg', COLORS.INK, COLORS.BG],
    ]
    for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5)
  })

  it('leaderboard and dashboard text meets 4.5:1 on its surfaces', () => {
    const meRow = blend(COLORS.ACCENT, COLORS.PANEL, 16)
    const pairs: Array<[string, number, number]> = [
      ['row name (ink) on panel', COLORS.INK, COLORS.PANEL],
      ['row score (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['row rank (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['row sub line (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['me row name (ink)', COLORS.INK, meRow],
      ['me row score (gold)', COLORS.GOLD, meRow],
      ['me row sub line (ink-muted)', COLORS.INK_MUTED, meRow],
      ['rival label (ghost) on panel', COLORS.GHOST, COLORS.PANEL],
      ['rival label (ghost) on bg', COLORS.GHOST, COLORS.BG],
      ['You tag (bg) on accent', COLORS.BG, COLORS.ACCENT],
      ['Provisional tag (accent) on the me row', COLORS.ACCENT, meRow],
      ['selected tab (bg) on pumpkin', COLORS.BG, COLORS.PUMPKIN],
      ['selected tab (bg) on ember', COLORS.BG, COLORS.EMBER],
      ['unselected tab (ink) on panel', COLORS.INK, blend(COLORS.PANEL, COLORS.BG, 85)],
      ['unselected tab hover (ink) on deep', COLORS.INK, COLORS.DEEP],
      ['podium name (ink) on indigo', COLORS.INK, COLORS.INDIGO],
      ['podium score (gold) on indigo', COLORS.GOLD, COLORS.INDIGO],
      ['podium meta (ink-muted) on indigo', COLORS.INK_MUTED, COLORS.INDIGO],
      ['podium numeral (bone) on deep', COLORS.BONE, COLORS.DEEP],
      ['podium first numeral (gold) on deep', COLORS.GOLD, COLORS.DEEP],
      ['dashboard seal (gold) on deep', COLORS.GOLD, COLORS.DEEP],
      ['dashboard seal (gold) on bg', COLORS.GOLD, COLORS.BG],
      ['card heading (ink-muted) on surface-2', COLORS.INK_MUTED, COLORS.SURFACE_2],
      ['dashboard board name (ink) on the me row', COLORS.INK, meRow],
      ['badge earned (ink)', COLORS.INK, blend(COLORS.GOLD, COLORS.PANEL, 12)],
      ['badge locked (ink-muted) on bg', COLORS.INK_MUTED, COLORS.BG],
      ['stale note (ember) on bg', COLORS.EMBER, COLORS.BG],
    ]
    for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5)
  })

  it('auth screens, the Waking up loader and the Offline label meet their minimums', () => {
    const pairs: Array<[string, number, number]> = [
      ['input text (ink) on bg', COLORS.INK, COLORS.BG],
      ['field label (ink) on panel', COLORS.INK, COLORS.PANEL],
      ['field label (ink) on surface-2', COLORS.INK, COLORS.SURFACE_2],
      ['blurb and hint (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['blurb and hint (ink-muted) on surface-2', COLORS.INK_MUTED, COLORS.SURFACE_2],
      ['field error (danger mix) on panel', mixInk(COLORS.DANGER, 45), COLORS.PANEL],
      ['field error (danger mix) on surface-2', mixInk(COLORS.DANGER, 45), COLORS.SURFACE_2],
      ['auth heading (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['switch link (gold) on surface-2', COLORS.GOLD, COLORS.SURFACE_2],
      ['show/hide icon (ink) on bg', COLORS.INK, COLORS.BG],
      ['show/hide hover (ink) on deep', COLORS.INK, COLORS.DEEP],
      ['submit text (bg) on pumpkin', COLORS.BG, COLORS.PUMPKIN],
      ['submit text (bg) on ember', COLORS.BG, COLORS.EMBER],
      ['loader title (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['loader tip (ink) on panel', COLORS.INK, COLORS.PANEL],
      ['loader note (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['Offline label (bg) on accent', COLORS.BG, COLORS.ACCENT],
    ]
    for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5)
    // Input border and the loader spinner are non-text graphics (3:1).
    expect(contrastRatio(COLORS.MAGIC, COLORS.BG)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.ACCENT, COLORS.PANEL)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.DANGER, COLORS.BG)).toBeGreaterThanOrEqual(3)
  })

  it('badge and avatar graphics meet 3:1', () => {
    expect(contrastRatio(COLORS.GOLD, COLORS.BG)).toBeGreaterThanOrEqual(3)
    for (const c of [COLORS.PUMPKIN, COLORS.GHOST, COLORS.BLOOD_RED, COLORS.BONE, COLORS.MAGIC, COLORS.GOLD]) {
      expect(contrastRatio(c, COLORS.BG), `avatar ring ${c.toString(16)}`).toBeGreaterThanOrEqual(3)
    }
  })

  // Phase 3 (frontend-08): Daily Haunt, mode picker, exam timer, Haunted Hall banner and the finale.
  it('daily haunt, mode picker, exam timer and finale text meets 4.5:1 on its surfaces', () => {
    const celebrate = blend(COLORS.GHOST, COLORS.BG, 10)
    const hauntCta = blend(COLORS.GHOST, COLORS.PANEL, 22)
    const pairs: Array<[string, number, number]> = [
      ['celebration title (bone)', COLORS.BONE, celebrate],
      ['celebration text (ink-muted)', COLORS.INK_MUTED, celebrate],
      ['haunt button text (ink) at its lightest', COLORS.INK, hauntCta],
      ['due count (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['due count (ink-muted) on surface-2', COLORS.INK_MUTED, COLORS.SURFACE_2],
      ['streak (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['streak (gold) on surface-2', COLORS.GOLD, COLORS.SURFACE_2],
      ['mode name (bone) on bg', COLORS.BONE, COLORS.BG],
      ['mode name (bone) on deep (hover)', COLORS.BONE, COLORS.DEEP],
      ['mode blurb (ink-muted) on bg', COLORS.INK_MUTED, COLORS.BG],
      ['mode blurb (ink-muted) on deep (hover)', COLORS.INK_MUTED, COLORS.DEEP],
      ['exam timer (ink) on the HUD surface', COLORS.INK, blend(COLORS.PANEL, COLORS.BG, 92)],
      ['hall banner (ink) on the HUD surface', COLORS.INK, blend(COLORS.PANEL, COLORS.BG, 92)],
      ['finale count (bone) on panel', COLORS.BONE, COLORS.PANEL],
      ['finale note (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
    ]
    for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5)
    // Borders and rings are non-text graphics (3:1): the ghost ring, the timer ring and its low-time ring.
    for (const c of [COLORS.GHOST, COLORS.MAGIC, COLORS.DANGER]) {
      expect(contrastRatio(c, COLORS.PANEL), `ring ${c.toString(16)}`).toBeGreaterThanOrEqual(3)
    }
  })

  // Phase 4 (frontend-08): Memory scroll, requeue whisper, Progress panel, streak calendar and the node tooltip.
  it('memory scroll text meets 4.5:1 on every parchment tone of the scroll', () => {
    // Paper: bone to ember-14%-over-ink, with an ember 22% glow at the bottom edge.
    const bottom = blend(COLORS.EMBER, COLORS.INK, 14)
    const tones = [COLORS.BONE, bottom, blend(COLORS.EMBER, bottom, 22), blend(COLORS.EMBER, COLORS.BONE, 22)]
    const darkDanger = blend(COLORS.BG, COLORS.DANGER, 45)
    for (const tone of tones) {
      const at = tone.toString(16)
      expect(contrastRatio(COLORS.BG, tone), `body and answer on ${at}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.DEEP, tone), `title and label on ${at}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(darkDanger, tone), `incorrect text on ${at}`).toBeGreaterThanOrEqual(4.5)
      // The quote's left rule and the focus ring are graphics (3:1).
      expect(contrastRatio(COLORS.DEEP, tone), `rule on ${at}`).toBeGreaterThanOrEqual(3)
    }
    // Whisper: bg text on a ghost 28% tint over the parchment.
    for (const tone of tones) {
      expect(contrastRatio(COLORS.BG, blend(COLORS.GHOST, tone, 28)), `whisper on ${tone.toString(16)}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.DEEP, blend(COLORS.DEEP, tone, 14)), `second-chance tag on ${tone.toString(16)}`).toBeGreaterThanOrEqual(4.5)
    }
    // Primary scroll button: ink on deep.
    expect(contrastRatio(COLORS.INK, COLORS.DEEP)).toBeGreaterThanOrEqual(4.5)
  })

  it('progress panel, streak calendar and the node tooltip meet their minimums', () => {
    for (const bg of [COLORS.PANEL, COLORS.SURFACE_2]) {
      expect(contrastRatio(COLORS.INK_MUTED, bg), 'heading and weekday labels').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.BONE, bg), 'big number').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.GOLD, bg), 'page ref').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.EMBER, bg), 'Learning band').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(COLORS.TOXIC, bg), 'Strong band').toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(mixInk(COLORS.DANGER, 45), bg), 'Weak band').toBeGreaterThanOrEqual(4.5)
      // Calendar day outline (graphic).
      expect(contrastRatio(COLORS.INK_MUTED, bg), 'empty day outline').toBeGreaterThanOrEqual(3)
    }
    // A reviewed day: the check mark (bg) on the gold square.
    expect(contrastRatio(COLORS.BG, COLORS.GOLD)).toBeGreaterThanOrEqual(4.5)
    // Node tooltip text on the panel.
    expect(contrastRatio(COLORS.INK, COLORS.PANEL)).toBeGreaterThanOrEqual(4.5)
  })

  it('witch colour is never used as a text colour', () => {
    const fs = nodeProcess.getBuiltinModule('node:fs') as unknown as {
      readFileSync(path: string, enc: string): string
      readdirSync(path: string): string[]
    }
    const root = `${nodeProcess.cwd()}/src`
    // CSS: a `color:` declaration with the witch token is only allowed on decorative bat shapes.
    for (const file of fs.readdirSync(`${root}/styles`).filter((f) => f.endsWith('.css'))) {
      const text = fs.readFileSync(`${root}/styles/${file}`, 'utf8')
      const rule = /([^{}]+)\{([^{}]*)\}/g
      let m: RegExpExecArray | null
      while ((m = rule.exec(text))) {
        if (/(^|[;\s])color:\s*var\(--color-witch\)/.test(m[2])) {
          expect(m[1], `${file}: ${m[1].trim()}`).toMatch(/bat/)
        }
      }
    }
    // TSX: no text-witch utility.
    for (const dir of ['components', 'pages', 'leaderboard', 'dashboard', 'scorecard', 'badges']) {
      for (const file of fs.readdirSync(`${root}/${dir}`).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))) {
        expect(fs.readFileSync(`${root}/${dir}/${file}`, 'utf8'), `${dir}/${file}`).not.toMatch(/text-witch|color-witch\)\]/)
      }
    }
  })
})

// Phase 6 (frontend-08): tutorial, equip buttons and the landing "How to play" link.
describe('Phase 6 text and UI pairs', () => {
  it('tutorial text, option labels and the muted hint meet 4.5:1 on the dialog surfaces', () => {
    for (const bg of [COLORS.PANEL, COLORS.DEEP, COLORS.BG]) {
      expect(contrastRatio(COLORS.INK, bg), 'ink on tutorial surface').toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio(COLORS.INK_MUTED, COLORS.PANEL), 'step count and live line').toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(COLORS.INK_MUTED, COLORS.BG), 'How to play link').toBeGreaterThanOrEqual(4.5)
  })
  it('tutorial option borders, the focus outline and the equip button border are at least 3:1', () => {
    expect(contrastRatio(COLORS.GOLD, COLORS.PANEL)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.TOXIC, COLORS.PANEL)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.GOLD, COLORS.DEEP)).toBeGreaterThanOrEqual(3)
  })
  it('an equipped weapon button (bg text on gold) is at least 4.5:1', () => {
    expect(contrastRatio(COLORS.BG, COLORS.GOLD)).toBeGreaterThanOrEqual(4.5)
  })
})

// Phase 8 (frontend-07): the upload wizard.
describe('Upload wizard text and UI pairs', () => {
  const blend = (fg: number, bg: number, fgPct: number): number => {
    const ch = (shift: number) =>
      Math.round(((fg >> shift) & 255) * (fgPct / 100) + ((bg >> shift) & 255) * (1 - fgPct / 100))
    return (ch(16) << 16) | (ch(8) << 8) | ch(0)
  }
  const dangerText = blend(COLORS.INK, COLORS.DANGER, 45)

  it('step labels, states, file details, hints and errors meet 4.5:1 on the wizard surfaces', () => {
    const topicRow = blend(COLORS.BG, COLORS.PANEL, 40)
    const dropActive = blend(COLORS.DEEP, COLORS.PANEL, 100)
    const pairs: Array<[string, number, number]> = [
      ['step waiting (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['step in progress (ghost) on panel', COLORS.GHOST, COLORS.PANEL],
      ['step done (toxic) on panel', COLORS.TOXIC, COLORS.PANEL],
      ['step stopped (danger mix) on panel', dangerText, COLORS.PANEL],
      ['drop title (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['drop title (gold) on the dragged-over fill (deep)', COLORS.GOLD, dropActive],
      ['formats note (ink-muted) on panel', COLORS.INK_MUTED, COLORS.PANEL],
      ['formats note (ink-muted) on the dragged-over fill (deep)', COLORS.INK_MUTED, dropActive],
      ['file name (bone) on panel', COLORS.BONE, COLORS.PANEL],
      ['file name (bone) on surface-2', COLORS.BONE, COLORS.SURFACE_2],
      ['size and muted text (ink-muted) on surface-2', COLORS.INK_MUTED, COLORS.SURFACE_2],
      ['hint (ember) on panel', COLORS.EMBER, COLORS.PANEL],
      ['hint (ember) on surface-2', COLORS.EMBER, COLORS.SURFACE_2],
      ['error (danger mix) on panel', dangerText, COLORS.PANEL],
      ['error (danger mix) on surface-2', dangerText, COLORS.SURFACE_2],
      ['topic name (bone) on its row', COLORS.BONE, topicRow],
      ['topic note (ink-muted) on its row', COLORS.INK_MUTED, topicRow],
      ['result heading (gold) on panel', COLORS.GOLD, COLORS.PANEL],
      ['result heading (gold) on surface-2', COLORS.GOLD, COLORS.SURFACE_2],
      ['floor name (bone) on panel', COLORS.BONE, COLORS.PANEL],
      ['upload button text (bg) on pumpkin', COLORS.BG, COLORS.PUMPKIN],
      ['upload button text (bg) on ember', COLORS.BG, COLORS.EMBER],
      ['choose-a-file text (ink) on panel', COLORS.INK, COLORS.PANEL],
      ['choose-a-file text (ink) on deep (hover)', COLORS.INK, COLORS.DEEP],
    ]
    for (const [name, fg, bg] of pairs) expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5)
  })

  it('the rune seal, drop border, step rings and focus outline meet 3:1', () => {
    expect(contrastRatio(COLORS.GOLD, COLORS.PANEL), 'rune seal').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.MAGIC, COLORS.PANEL), 'drop border').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.ACCENT, COLORS.DEEP), 'dragged-over border').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(COLORS.ACCENT, COLORS.PANEL), 'focus outline').toBeGreaterThanOrEqual(3)
    for (const c of [COLORS.INK_MUTED, COLORS.GHOST, COLORS.TOXIC, dangerText]) {
      expect(contrastRatio(c, COLORS.PANEL), `step ring ${c.toString(16)}`).toBeGreaterThanOrEqual(3)
    }
  })
})
