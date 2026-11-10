import { useEffect, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/landing.css';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Flame, Ghost, Play, Skull, Sword } from 'lucide-react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { PixelSprite } from '../components/PixelSprite';
import { CHARACTER_SPRITES } from '../art/sprites';
import { TutorialFlow } from '../tutorial/TutorialFlow';
import { needsFirstRun } from '../tutorial/tutorialFlag';
import { useStartDemo } from '../state/useStartDemo';
import { WakingUp } from './WakingUp';

const STEPS = [
  { icon: BookOpen, title: 'Upload notes', text: 'Feed your study notes to the library.' },
  { icon: Ghost, title: 'Explore the dungeon', text: 'Wander haunted rooms built from your material.' },
  { icon: Sword, title: 'Defeat monsters by answering', text: 'Every correct answer lands a blow.' },
];

type BatSpec = { dir: 'ltr' | 'rtl'; top: number; size: number; dur: number; delay: number; rest: number }

/** Six bats: varied heights, sizes and speeds, flying both ways. Capped so the sky stays light. */
const BATS: readonly BatSpec[] = [
  { dir: 'ltr', top: 9, size: 34, dur: 19, delay: -4, rest: 12 },
  { dir: 'rtl', top: 17, size: 22, dur: 26, delay: -11, rest: 68 },
  { dir: 'ltr', top: 27, size: 28, dur: 23, delay: -17, rest: 38 },
  { dir: 'rtl', top: 36, size: 40, dur: 16, delay: -2, rest: 84 },
  { dir: 'ltr', top: 5, size: 18, dur: 31, delay: -21, rest: 55 },
  { dir: 'rtl', top: 45, size: 26, dur: 21, delay: -9, rest: 24 },
]

/** 11x7 pixel-art bat drawn with rects. The two wings flap (scaleY) from CSS; the wrapper does the flight. */
function Bat({ spec, index }: { spec: BatSpec; index: number }) {
  const style = {
    '--bat-top': `${spec.top}%`,
    '--bat-size': `${spec.size}px`,
    '--bat-dur': `${spec.dur}s`,
    '--bat-delay': `${spec.delay}s`,
    '--bat-rest': `${spec.rest}%`,
  } as CSSProperties
  return (
    <div className={`sd-bat sd-bat--${spec.dir}`} data-testid={`bat-${index}`} style={style}>
      <svg aria-hidden="true" viewBox="0 0 11 7" className="sd-bat__svg" fill="currentColor" shapeRendering="crispEdges">
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
    </div>
  )
}

/** True while the tab is hidden, so the sky animations can pause instead of running unseen. */
function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

export default function LandingPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const demo = useStartDemo();
  const { pending, error } = demo;
  const [introOpen, setIntroOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const hidden = useTabHidden();
  // One first-run flow per browser: the intro cards, then the five tutorial steps (sd.introSeen, sd.tutorialSeen).
  // Finishing or skipping at any step stores both flags, and later visits go straight in.
  const tryDemo = () => {
    if (needsFirstRun()) setIntroOpen(true);
    else void demo.start();
  };
  const firstRunDone = () => {
    setIntroOpen(false);
    void demo.start();
  };

  return (
    <div
      data-reduced={reduce ? 'true' : undefined}
      data-tab-hidden={hidden ? 'true' : undefined}
      data-testid="landing-root"
      className="sd-sky sd-landing relative flex flex-col overflow-hidden bg-bg text-ink"
    >
      <div aria-hidden="true" data-testid="landing-sky" className="sd-landing__sky">
        <div className="sd-moon" />
        <div className="sd-fog sd-fog--a" />
        <div className="sd-fog sd-fog--b" />
        {BATS.map((spec, i) => (
          <Bat key={i} spec={spec} index={i} />
        ))}
        <Flame className="sd-flicker absolute bottom-[3%] left-[8%] h-12 w-12 text-accent" />
        <Flame className="sd-flicker absolute bottom-[3%] right-[8%] h-12 w-12 text-accent" />
        <div className="hidden md:block">
          <PixelSprite map={CHARACTER_SPRITES.haunted_portrait} scale={4} className="absolute left-[2%] top-[16%] opacity-90" />
          <PixelSprite map={CHARACTER_SPRITES.black_cat} scale={4} className="absolute bottom-[3%] left-[3%]" />
          <PixelSprite map={CHARACTER_SPRITES.skeleton_companion} scale={4} className="absolute bottom-[3%] right-[3%]" />
          <PixelSprite map={CHARACTER_SPRITES.small_vampire} scale={4} className="absolute right-[3%] top-[44%]" />
          <PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={4} className="sd-drift absolute left-[3%] top-[44%]" />
        </div>
      </div>

      <header className="sd-landing__bar relative flex items-center gap-2">
        <Skull aria-hidden="true" className="h-6 w-6 text-danger" />
        <span className="font-(family-name:--font-label) font-semibold tracking-wide">StudyDungeon</span>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 font-(family-name:--font-label) text-sm">
          <Link to="/dashboard" className="rounded px-1 py-2 text-ink underline-offset-4 hover:underline">
            Dashboard
          </Link>
          <Link to="/leaderboard" className="rounded px-1 py-2 text-ink underline-offset-4 hover:underline">
            Leaderboard
          </Link>
        </nav>
      </header>

      <main className="sd-landing__main relative">
        <div className="sd-landing__content">
          <section className="sd-landing__hero">
            <h1 className="sd-title-flicker sd-landing__title font-(family-name:--font-display) text-gold">StudyDungeon</h1>
            <p className="sd-landing__tag font-(family-name:--font-label) text-ink-muted">Turn your notes into a haunted dungeon.</p>
            <div className="sd-landing__actions">
              <Button className="sd-pumpkin-btn" onClick={tryDemo} loading={pending}>
                Try the Demo
              </Button>
              <button type="button" onClick={() => setReplayOpen(true)} className="sd-ghost-pill">
                <Play aria-hidden="true" size={16} />
                {'How to play \u00b7 30 sec'}
              </button>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Login
                </Button>
                <Button variant="secondary" onClick={() => navigate('/register')}>
                  Create account
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-[color-mix(in_srgb,var(--color-danger),var(--color-ink)_45%)]">
                  {error}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="how-it-works" className="w-full">
            <h2 id="how-it-works" className="sd-landing__how font-(family-name:--font-display) text-ink">
              How it works
            </h2>
            <ol className="sd-landing__cards">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <Panel as="li" tone="gold" key={title} className="sd-landing__card text-left">
                  <Icon aria-hidden="true" className="h-7 w-7 text-health" />
                  <div>
                    <h3 className="font-(family-name:--font-label) font-semibold">
                      {i + 1}. {title}
                    </h3>
                    <p className="text-sm text-ink-muted">{text}</p>
                  </div>
                </Panel>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="sd-landing__foot relative text-center text-sm text-ink-muted">Beware the stacks after dark.</footer>
      {introOpen && <TutorialFlow onDone={firstRunDone} />}
      {replayOpen && <TutorialFlow includeIntro={false} onDone={() => setReplayOpen(false)} />}
      {pending && <WakingUp offerOffline={demo.offerOffline} onOffline={() => void demo.chooseOffline()} />}
    </div>
  );
}
