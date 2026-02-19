import Link from "next/link";
import { ArrowRight, Chrome, KeyRound } from "lucide-react";
import { loginWithGoogleAction, registerWithPasswordAction } from "@/app/auth-actions";
import { isGoogleOAuthAvailable } from "@/lib/supabase/google-oauth";

const tertiaryLinkClass =
  "text-sm text-[color:color-mix(in_oklab,var(--color-muted)_82%,var(--color-accent)_18%)] transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-4";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; error?: string }>;
}) {
  const { email, next, error } = await searchParams;
  const sessionEmail = typeof email === "string" && email.includes("@") ? email : "";
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";
  const googleAvailable = await isGoogleOAuthAvailable();

  return (
    <main className="mx-auto min-h-[calc(100vh-11rem)] max-w-[760px] px-4 py-8 md:px-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
          <KeyRound className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Step 1 · Register
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Create Account</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)] md:text-base">
          Create your account with email/password or Google.
        </p>
        {error ? <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-6 space-y-3">
          <form action={registerWithPasswordAction} className="space-y-2">
            <input type="hidden" name="next" value={nextPath} />
            <input
              id="register-email"
              name="email"
              type="email"
              required
              defaultValue={sessionEmail}
              placeholder="Email address"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Password (min 8 characters)"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
            />
            <input
              name="confirmPassword"
              type="password"
              required
              placeholder="Confirm password"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2.5 text-sm font-extrabold text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
            >
              Create account with Email
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {googleAvailable ? (
            <form action={loginWithGoogleAction}>
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-surface)]"
              >
                <Chrome className="h-4 w-4" />
                Continue with Google
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-muted)]">
              Google registration is temporarily unavailable.
            </p>
          )}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className={tertiaryLinkClass}>
            Already have an account? Login
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/welcome" className={tertiaryLinkClass}>
            Back to overview
          </Link>
        </div>
      </section>
    </main>
  );
}
