import type { CSSProperties } from 'react'
import { PortraitCanvas } from '../art/portraits/PortraitCanvas'
import '../styles/landing.css'
import '../styles/haunted.css'

type Fig = { kind: 'ghost' | 'vampire'; top: number; size: number; dur: number; delay: number; dir: 'l' | 'r' }
const FIGURES: readonly Fig[] = [
  { kind: 'ghost', top: 12, size: 72, dur: 44, delay: -6, dir: 'l' },
  { kind: 'vampire', top: 26, size: 68, dur: 58, delay: -18, dir: 'r' },
  { kind: 'ghost', top: 44, size: 58, dur: 48, delay: -32, dir: 'l' },
  { kind: 'vampire', top: 62, size: 84, dur: 62, delay: -24, dir: 'r' },
  { kind: 'ghost', top: 76, size: 64, dur: 52, delay: -40, dir: 'l' },
  { kind: 'ghost', top: 88, size: 52, dur: 46, delay: -14, dir: 'r' },
]

type BatSpec = { dir: 'ltr' | 'rtl'; top: number; size: number; dur: number; delay: number }
const BATS: readonly BatSpec[] = [
  { dir: 'ltr', top: 7, size: 30, dur: 22, delay: -4 },
  { dir: 'rtl', top: 19, size: 24, dur: 28, delay: -12 },
  { dir: 'ltr', top: 34, size: 34, dur: 25, delay: -18 },
  { dir: 'rtl', top: 50, size: 26, dur: 31, delay: -9 },
  { dir: 'ltr', top: 66, size: 36, dur: 24, delay: -15 },
  { dir: 'rtl', top: 78, size: 22, dur: 33, delay: -21 },
  { dir: 'ltr', top: 89, size: 28, dur: 26, delay: -7 },
]

/** Dangerous variant for the leaderboard: red eyes, swooping bats, lurking vampires, flickering ghosts. */
type MenaceFig = { kind: 'ghost' | 'vampire'; mode: 'ghost' | 'lurk-l' | 'lurk-r'; top: number; size: number; dur: number; delay: number }
const MENACE_FIGURES: readonly MenaceFig[] = [
  { kind: 'ghost', mode: 'ghost', top: 14, size: 68, dur: 38, delay: -4 },
  { kind: 'ghost', mode: 'ghost', top: 32, size: 56, dur: 44, delay: -18 },
  { kind: 'vampire', mode: 'lurk-l', top: 42, size: 110, dur: 18, delay: -4 },
  { kind: 'vampire', mode: 'lurk-r', top: 62, size: 96, dur: 22, delay: -12 },
  { kind: 'ghost', mode: 'ghost', top: 74, size: 54, dur: 50, delay: -26 },
  { kind: 'vampire', mode: 'lurk-l', top: 86, size: 90, dur: 20, delay: -8 },
]
const MENACE_BATS: readonly (BatSpec & { swoop: 'l' | 'r' })[] = [
  { dir: 'ltr', swoop: 'l', top: 10, size: 34, dur: 11, delay: -2 },
  { dir: 'rtl', swoop: 'r', top: 28, size: 30, dur: 13, delay: -6 },
  { dir: 'ltr', swoop: 'l', top: 48, size: 36, dur: 12, delay: -8 },
  { dir: 'rtl', swoop: 'r', top: 68, size: 28, dur: 14, delay: -4 },
  { dir: 'ltr', swoop: 'l', top: 84, size: 38, dur: 13, delay: -1 },
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
