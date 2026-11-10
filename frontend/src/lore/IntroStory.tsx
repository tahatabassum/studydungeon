import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import '../styles/lore.css'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import { INTRO_CARDS, type IntroCard, type IntroIllustration } from './intro'

export interface IntroStoryProps {
  /** Called when the last card is done or the story is skipped. The caller stores the flag. */
  onDone(reason: 'finished' | 'skipped'): void
  cards?: readonly IntroCard[]
}

/** Code-drawn scenes (inline SVG, palette tokens only). Decorative: the text carries the meaning. */
function Scene({ art }: { art: IntroIllustration }) {
  return (
    <svg className="sd-intro__art" viewBox="0 0 240 140" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="240" height="140" rx="10" fill="var(--color-deep)" />
      <circle cx="198" cy="30" r="14" fill="var(--color-bone)" opacity="0.9" />
      <rect x="0" y="116" width="240" height="24" fill="var(--color-bg)" />
      {art === 'warden' && (
        <g>
          <path d="M86 116 V58 Q120 24 154 58 V116 Z" fill="var(--color-witch)" />
          <rect x="104" y="64" width="12" height="9" rx="2" fill="var(--color-gold)" />
          <rect x="124" y="64" width="12" height="9" rx="2" fill="var(--color-gold)" />
          <path d="M106 92 H134" stroke="var(--color-bone)" strokeWidth="3" strokeLinecap="round" />
          <rect x="150" y="70" width="26" height="34" rx="3" fill="var(--color-bone)" />
          <path d="M155 80 H171 M155 88 H171 M155 96 H165" stroke="var(--color-deep)" strokeWidth="2" />
        </g>
      )}
      {art === 'ghost' && (
        <g>
          <path d="M92 116 V70 Q92 34 120 34 Q148 34 148 70 V116 L138 106 L128 116 L118 106 L108 116 L100 108 Z" fill="var(--color-bone)" />
          <circle cx="108" cy="68" r="5" fill="var(--color-bg)" />
          <circle cx="132" cy="68" r="5" fill="var(--color-bg)" />
          <ellipse cx="120" cy="86" rx="7" ry="9" fill="var(--color-bg)" />
          <rect x="164" y="52" width="30" height="40" rx="3" fill="var(--color-ink-muted)" transform="rotate(8 179 72)" />
          <path d="M170 62 H188 M170 70 H188 M170 78 H182" stroke="var(--color-deep)" strokeWidth="2" transform="rotate(8 179 72)" />
        </g>
      )}
      {art === 'quiz' && (
        <g>
          <rect x="60" y="40" width="120" height="76" rx="8" fill="var(--color-panel)" stroke="var(--color-gold)" strokeWidth="3" />
          <text x="120" y="92" textAnchor="middle" fontSize="48" fontWeight="700" fill="var(--color-gold)" fontFamily="var(--font-display)">
            ?
          </text>
          <circle cx="84" cy="30" r="4" fill="var(--color-toxic)" />
          <circle cx="156" cy="26" r="3" fill="var(--color-magenta)" />
          <circle cx="198" cy="84" r="4" fill="var(--color-magic)" />
        </g>
      )}
      {art === 'lantern' && (
        <g>
          <circle cx="120" cy="76" r="44" fill="var(--color-pumpkin)" opacity="0.18" />
          <rect x="104" y="44" width="32" height="8" rx="2" fill="var(--color-ink-muted)" />
          <rect x="108" y="52" width="24" height="44" rx="4" fill="var(--color-pumpkin)" />
          <rect x="114" y="60" width="12" height="28" rx="6" fill="var(--color-gold)" />
          <rect x="104" y="96" width="32" height="8" rx="2" fill="var(--color-ink-muted)" />
          <path d="M112 44 Q120 28 128 44" fill="none" stroke="var(--color-ink-muted)" strokeWidth="3" />
        </g>
      )}
    </svg>
  )
}

/**
 * A short, skippable intro story (Req 15.4): original, funny-spooky and non-gory. Keyboard: Enter or Space on
 * Next, Esc skips. The card text is in a polite live region so a screen reader hears each card. Under reduced
 * motion the cards swap without animation. Text and code-drawn art only, no network.
 */
export function IntroStory({ onDone, cards = INTRO_CARDS }: IntroStoryProps) {
  const reduced = !!useReducedMotion()
  const [index, setIndex] = useState(0)
  const card = cards[Math.min(index, cards.length - 1)]
  const last = index >= cards.length - 1
  if (cards.length === 0) return null

  return (
    <OverlayFrame
      title={card.title}
      titleId="intro-title"
      describedBy="intro-text"
      initialFocus="button[data-intro-next]"
      onEscape={() => onDone('skipped')}
      widthClass="max-w-xl"
      zClass="z-70"
    >
      <div className="sd-intro" data-testid="intro-story" data-card={card.id} data-reduced={reduced ? 'true' : undefined}>
        <div key={card.id} className="sd-intro__card">
          <Scene art={card.art} />
          <p id="intro-text" role="status" aria-live="polite" className="sd-intro__text">
            {card.text}
          </p>
        </div>
        <p className="sd-intro__count" data-testid="intro-count">{`Card ${index + 1} of ${cards.length}`}</p>
        <div className="sd-intro__actions font-(family-name:--font-label)">
          {index > 0 && (
            <Button variant="secondary" onClick={() => setIndex(index - 1)}>
              <ChevronLeft aria-hidden="true" size={16} />
              Back
            </Button>
          )}
          <Button variant="secondary" onClick={() => onDone('skipped')} data-intro-skip>
            <SkipForward aria-hidden="true" size={16} />
            Skip intro
          </Button>
          <Button
            data-intro-next
            onClick={() => (last ? onDone('finished') : setIndex(index + 1))}
          >
            {last ? 'Enter the dungeon' : 'Next'}
            {!last && <ChevronRight aria-hidden="true" size={16} />}
          </Button>
        </div>
      </div>
    </OverlayFrame>
  )
}
