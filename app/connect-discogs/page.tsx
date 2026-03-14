export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthStartLink } from "@/components/auth-start-link";
import { HighlightActionLink } from "@/components/highlight-action";
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
    <main className="mx-auto max-w-[900px] px-3 py-6 sm:px-4 md:px-8 md:py-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Connect your Discogs account</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">Authenticate once, then DigQueue can pull wants and sync wishlist actions for your Discogs account.</p>
        {!userId ? (
          <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Login is required before connecting Discogs.
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
          <p className="text-sm font-medium">What will happen</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            <li>Click <span className="mono">Connect Discogs</span>.</li>
            <li>Approve access on Discogs.</li>
            <li>You are redirected back and DigQueue starts wishlist sync.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {userId ? (
            <AuthStartLink
              provider="discogs"
              nextPath={nextPath}
              className="sm:w-auto"
            >
              Connect Discogs
              <ArrowRight className="h-4 w-4" />
            </AuthStartLink>
          ) : (
            <HighlightActionLink
              href="/login"
              className="sm:w-auto"
              width="full"
              weight="extrabold"
            >
              Login First
              <ArrowRight className="h-4 w-4" />
            </HighlightActionLink>
          )}
          <Link href="/login" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-center text-sm hover:bg-[var(--color-surface2)]">
            Back: Account step
          </Link>
          <Link href="/" className="rounded-md border border-[var(--color-border)] px-4 py-2 text-center text-sm hover:bg-[var(--color-surface2)]">
            Back to current app
          </Link>
        </div>
      </section>
    </main>
  );
}
