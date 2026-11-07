import { useRef, useState } from 'react';
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

export default function LandingPage() {
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-magic/30 blur-3xl" />
        <div className="sd-drift absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-muted/20 to-transparent blur-2xl" />
        <Flame className="sd-flicker absolute bottom-10 left-[8%] h-12 w-12 text-accent" />
        <Flame className="sd-flicker absolute bottom-10 right-[8%] h-12 w-12 text-accent" />
        <div className="hidden md:block">
          <PixelSprite map={CHARACTER_SPRITES.haunted_portrait} scale={4} className="absolute left-[4%] top-24 opacity-90" />
          <PixelSprite map={CHARACTER_SPRITES.bat} scale={4} className="absolute right-[6%] top-20 motion-safe:animate-bounce" />
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
          <h1 className="font-(family-name:--font-display) text-6xl text-gold sm:text-7xl">StudyDungeon</h1>
          <p className="max-w-xl font-(family-name:--font-label) text-lg text-ink-muted">
            Turn your notes into a haunted dungeon.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button onClick={startDemo} loading={pending}>
              Try the Demo
            </Button>
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Login
            </Button>
            <p role="status" aria-live="polite" className="min-h-6 text-accent">
              {pending ? 'Waking up the dungeon...' : ''}
            </p>
            {error && (
              <p role="alert" className="text-danger">
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
