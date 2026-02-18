import Link from "next/link";
import { ArrowRight, Music2 } from "lucide-react";

export default function ConnectDiscogsPage() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-low)] reveal">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <Music2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Step 2: Login
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Login with Discogs</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">
          Use your Discogs identity as your DigQueue sign-in path after creating your account.
        </p>

        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
          <p className="text-sm">
            Planned behavior: click <span className="mono">Continue with Discogs</span>, approve access, and land back in DigQueue.
            Your account is already created via email or Google.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
          >
            Continue with Discogs
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link href="/register" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
            Create account first
          </Link>
          <Link href="/" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
            Back to current app
          </Link>
        </div>
      </section>
    </main>
  );
}
