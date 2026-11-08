import { Link } from 'react-router-dom';
import { Frame } from '../components/Frame';
import { PixelSprite } from '../components/PixelSprite';
import { CHARACTER_SPRITES } from '../art/sprites';

export default function LoginPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Frame
          className="w-full"
          title={<h1 className="font-(family-name:--font-display) text-4xl text-gold">Login</h1>}
        >
          <div className="flex flex-col items-center gap-4">
            <PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={4} />
            <p className="text-ink-muted">Login is coming soon</p>
            <Link
              to="/"
              className="rounded-lg border-2 border-ink-muted px-5 py-2 font-(family-name:--font-label) text-ink-muted hover:border-ink hover:text-ink"
            >
              Back to home
            </Link>
          </div>
        </Frame>
      </main>
    </div>
  );
}
