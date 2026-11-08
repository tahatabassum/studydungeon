import { useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import '../styles/landing.css';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Flame, Ghost, Skull, Sword } from 'lucide-react';
import { ApiError, getApi } from '../api';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { PixelSprite } from '../components/PixelSprite';
import { CHARACTER_SPRITES } from '../art/sprites';
import { useSession } from '../state/SessionContext';

const STEPS = [
  { icon: BookOpen, title: 'Upload notes', text: 'Feed your study notes to the library.' },
  { icon: Ghost, title: 'Explore the dungeon', text: 'Wander haunted rooms built from your material.' },
  { icon: Sword, title: 'Defeat monsters by answering', text: 'Every correct answer lands a blow.' },
];

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return 'Too many demo starts, try again soon.';
  }
  return 'Could not start the demo. Please try again.';
}

/** Inline SVG bat silhouette (decorative). */
function BatSvg({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 16" className={className} fill="currentColor">
      <path d="M16 4 L18 1 L19 5 Q24 2 31 6 Q27 6 25 9 Q23 7 21 9 Q19 7 18 11 L16 15 L14 11 Q13 7 11 9 Q9 7 7 9 Q5 6 1 6 Q8 2 13 5 L14 1 Z" />
    </svg>
  );
}

export default function LandingPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { setSession } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function startDemo() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const api = await getApi();
      const res = await api.startDemoSession();
      setSession(res);
      navigate('/play');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div
      data-reduced={reduce ? 'true' : undefined}
      className="sd-sky relative flex min-h-screen flex-col overflow-hidden bg-bg text-ink"
    >
      <div aria-hidden="true" data-testid="landing-sky" className="pointer-events-none absolute inset-0">
        <div className="sd-moon" />
        <div className="sd-fog sd-fog--a" />
        <div className="sd-fog sd-fog--b" />
        <BatSvg className="sd-bat sd-bat--1" />
        <BatSvg className="sd-bat sd-bat--2" />
        <BatSvg className="sd-bat sd-bat--3" />
        <Flame className="sd-flicker absolute bottom-10 left-[8%] h-12 w-12 text-accent" />
        <Flame className="sd-flicker absolute bottom-10 right-[8%] h-12 w-12 text-accent" />
        <div className="hidden md:block">
          <PixelSprite map={CHARACTER_SPRITES.haunted_portrait} scale={4} className="absolute left-[4%] top-24 opacity-90" />
          <PixelSprite map={CHARACTER_SPRITES.black_cat} scale={4} className="absolute bottom-6 left-[15%]" />
          <PixelSprite map={CHARACTER_SPRITES.skeleton_companion} scale={4} className="absolute bottom-6 right-[15%]" />
          <PixelSprite map={CHARACTER_SPRITES.small_vampire} scale={4} className="absolute right-[4%] top-1/2" />
          <PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={4} className="sd-drift absolute left-[5%] top-1/2" />
        </div>
      </div>

      <header className="relative flex items-center gap-2 px-6 py-4">
        <Skull aria-hidden="true" className="h-6 w-6 text-danger" />
        <span className="font-(family-name:--font-label) font-semibold tracking-wide">StudyDungeon</span>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-6 py-6 text-center">
        <section className="flex flex-col items-center gap-4">
          <h1 className="sd-title-flicker font-(family-name:--font-display) text-6xl text-gold sm:text-7xl">StudyDungeon</h1>
          <p className="max-w-xl font-(family-name:--font-label) text-lg text-ink-muted">
            Turn your notes into a haunted dungeon.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button className="sd-pumpkin-btn" onClick={startDemo} loading={pending}>
              Try the Demo
            </Button>
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Login
            </Button>
            <p role="status" aria-live="polite" className="min-h-6 text-accent">
              {pending ? 'Waking up the dungeon...' : ''}
            </p>
            {error && (
              <p role="alert" className="text-[color-mix(in_srgb,var(--color-danger),var(--color-ink)_45%)]">
                {error}
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="how-it-works" className="w-full">
          <h2 id="how-it-works" className="mb-4 font-(family-name:--font-display) text-3xl text-ink">
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Panel as="li" tone="gold" key={title} className="p-5 text-left">
                <Icon aria-hidden="true" className="mb-2 h-7 w-7 text-health" />
                <h3 className="font-(family-name:--font-label) font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="text-sm text-ink-muted">{text}</p>
              </Panel>
            ))}
          </ol>
        </section>
      </main>

      <footer className="relative px-6 py-4 text-center text-sm text-ink-muted">
        Beware the stacks after dark.
      </footer>
    </div>
  );
}
