export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, Music2 } from "lucide-react";
import { getCurrentAppUserId } from "@/lib/app-user";

export default async function ConnectDiscogsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const userId = await getCurrentAppUserId();
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <Music2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Step 2 · Connect Discogs
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Connect your Discogs account</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">Authenticate once, then DigQueue can pull wants and sync wishlist actions for your Discogs account.</p>
        {!userId ? (
          <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Login is required before connecting Discogs.
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
          <p className="text-sm">
            Use one click to authorize Discogs.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {userId ? (
            <a
              href={`/api/discogs/oauth/start?next=${encodeURIComponent(nextPath)}`}
              className="inline-flex items-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
            >
              Connect Discogs
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
            >
              Login First
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link href="/login" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
            Back: Account step
          </Link>
          <Link href="/" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface2)]">
            Back to current app
          </Link>
        </div>
      </section>
    </main>
  );
}
