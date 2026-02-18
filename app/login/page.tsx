import Link from "next/link";
import { ArrowRight, Disc3 } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-11rem)] max-w-[1100px] grid-cols-1 gap-4 px-4 py-8 md:px-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-low)] reveal">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Step 2</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Login with Discogs</h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--color-muted)]">
          After creating your account, continue with Discogs to enter DigQueue.
        </p>
        <Link
          href="/connect-discogs"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
        >
          Continue with Discogs
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          This will be the primary login path after Supabase backend wiring is complete.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link href="/register" className="rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface2)]">
            Create account first
          </Link>
        </div>
      </section>

      <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 reveal reveal-delay-1">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <Disc3 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Quick Start
        </p>
        <h2 className="mt-4 text-xl font-semibold">Connect Discogs and get going</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          New flow: create account, then login with Discogs and start processing labels.
        </p>
        <div className="mt-6">
          <Link
            href="/connect-discogs"
            className="inline-flex items-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
          >
            Connect Discogs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </main>
  );
}
