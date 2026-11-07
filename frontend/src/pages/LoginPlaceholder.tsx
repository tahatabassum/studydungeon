import { Link } from 'react-router-dom';

export default function LoginPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-3xl font-bold">Login</h1>
        <p className="text-ink-muted">Login is coming soon</p>
        <Link
          to="/"
          className="rounded-lg border-2 border-ink-muted px-5 py-2 text-ink-muted hover:border-ink hover:text-ink"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
