import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { completePasswordResetAction } from "@/app/auth-actions";

const tertiaryLinkClass =
  "text-sm text-[color:color-mix(in_oklab,var(--color-muted)_82%,var(--color-accent)_18%)] transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-4";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="mx-auto min-h-[calc(100vh-11rem)] max-w-[760px] px-4 py-8 md:px-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-110px] top-[-90px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,_rgba(216,169,96,0.2),_transparent_66%)]" />
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
          <KeyRound className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Account Recovery
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Set a new password</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
          Choose a new password for your account.
        </p>

        {error ? <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-3">
          <form action={completePasswordResetAction} className="space-y-2">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="New password (min 8 characters)"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
            />
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="Confirm new password"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2.5 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
            >
              Update password
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <Link href="/login" className={tertiaryLinkClass}>
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
