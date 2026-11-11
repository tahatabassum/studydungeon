import type { CSSProperties } from 'react'
import { PortraitCanvas } from '../art/portraits/PortraitCanvas'
import '../styles/landing.css'
import '../styles/haunted.css'

type Fig = { kind: 'ghost' | 'vampire'; top: number; size: number; dur: number; delay: number; dir: 'l' | 'r' }
const FIGURES: readonly Fig[] = [
  { kind: 'ghost', top: 14, size: 70, dur: 46, delay: -8, dir: 'l' },
  { kind: 'vampire', top: 58, size: 84, dur: 62, delay: -30, dir: 'r' },
  { kind: 'ghost', top: 72, size: 56, dur: 54, delay: -40, dir: 'r' },
]

type BatSpec = { dir: 'ltr' | 'rtl'; top: number; size: number; dur: number; delay: number }
const BATS: readonly BatSpec[] = [
  { dir: 'ltr', top: 8, size: 30, dur: 24, delay: -6 },
  { dir: 'rtl', top: 30, size: 22, dur: 30, delay: -14 },
  { dir: 'ltr', top: 48, size: 36, dur: 27, delay: -20 },
  { dir: 'rtl', top: 84, size: 26, dur: 33, delay: -3 },
]

/** Dangerous variant for the leaderboard: red eyes, swooping bats, lurking vampires, flickering ghosts. */
type MenaceFig = { kind: 'ghost' | 'vampire'; mode: 'ghost' | 'lurk-l' | 'lurk-r'; top: number; size: number; dur: number; delay: number }
const MENACE_FIGURES: readonly MenaceFig[] = [
  { kind: 'ghost', mode: 'ghost', top: 18, size: 64, dur: 40, delay: -6 },
  { kind: 'ghost', mode: 'ghost', top: 66, size: 52, dur: 52, delay: -28 },
  { kind: 'vampire', mode: 'lurk-l', top: 40, size: 110, dur: 18, delay: -4 },
  { kind: 'vampire', mode: 'lurk-r', top: 62, size: 96, dur: 22, delay: -12 },
]
const MENACE_BATS: readonly (BatSpec & { swoop: 'l' | 'r' })[] = [
  { dir: 'ltr', swoop: 'l', top: 12, size: 34, dur: 11, delay: -3 },
  { dir: 'rtl', swoop: 'r', top: 40, size: 28, dur: 14, delay: -8 },
  { dir: 'ltr', swoop: 'l', top: 70, size: 38, dur: 13, delay: -1 },
]

function BatSvg() {
  return (
    <svg viewBox="0 0 11 7" className="sd-bat__svg" fill="currentColor" shapeRendering="crispEdges">
      <rect x="4" y="0" width="1" height="1" />
      <rect x="6" y="0" width="1" height="1" />
      <rect x="4" y="1" width="3" height="3" />
      <rect x="5" y="4" width="1" height="1" />
      <g className="sd-bat__wing sd-bat__wing--l">
        <rect x="2" y="1" width="2" height="1" />
        <rect x="0" y="2" width="4" height="1" />
        <rect x="0" y="3" width="1" height="1" />
        <rect x="2" y="3" width="2" height="1" />
      </g>
      <g className="sd-bat__wing sd-bat__wing--r">
        <rect x="7" y="1" width="2" height="1" />
        <rect x="7" y="2" width="4" height="1" />
        <rect x="10" y="3" width="1" height="1" />
        <rect x="7" y="3" width="2" height="1" />
      </g>
    </svg>
  )
}

/** Decorative drifting ghosts, vampires and bats behind page content. Transform/opacity animations only. */
export function HauntedBackdrop({ variant = 'calm' }: { variant?: 'calm' | 'menace' }) {
  if (variant === 'menace') {
    return (
      <div aria-hidden="true" className="sd-haunted-backdrop sd-haunted-backdrop--menace" data-testid="menace-backdrop">
        {MENACE_FIGURES.map((f, i) => (
          <div
            key={`f${i}`}
            className={`sd-menace-fig sd-menace-fig--${f.mode}`}
            style={{ '--fig-top': `${f.top}%`, '--fig-size': `${f.size}px`, '--fig-dur': `${f.dur}s`, '--fig-delay': `${f.delay}s` } as CSSProperties}
          >
            <PortraitCanvas kind={f.kind} pose="idle" />
          </div>
        ))}
        {MENACE_BATS.map((b, i) => (
          <div
            key={`b${i}`}
            className={`sd-bat sd-bat--${b.dir} sd-bat--swoop-${b.swoop}`}
            style={{ '--bat-top': `${b.top}%`, '--bat-size': `${b.size}px`, '--bat-dur': `${b.dur}s`, '--bat-delay': `${b.delay}s` } as CSSProperties}
          >
            <BatSvg />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="sd-haunted-backdrop" data-testid="haunted-backdrop">
      {FIGURES.map((f, i) => (
        <div
          key={`f${i}`}
          className={`sd-haunted-fig sd-haunted-fig--${f.dir}`}
          style={{ '--fig-top': `${f.top}%`, '--fig-size': `${f.size}px`, '--fig-dur': `${f.dur}s`, '--fig-delay': `${f.delay}s` } as CSSProperties}
        >
          <PortraitCanvas kind={f.kind} pose="idle" />
        </div>
      ))}
      {BATS.map((b, i) => (
        <div
          key={`b${i}`}
          className={`sd-bat sd-bat--${b.dir}`}
          style={{ '--bat-top': `${b.top}%`, '--bat-size': `${b.size}px`, '--bat-dur': `${b.dur}s`, '--bat-delay': `${b.delay}s` } as CSSProperties}
        >
          <BatSvg />
        </div>
      ))}
    </div>
  )
}
