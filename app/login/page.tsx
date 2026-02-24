import { ArrowRight, Chrome } from "lucide-react";
import { loginWithPasswordAction, registerWithPasswordAction, requestPasswordResetAction } from "@/app/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; error?: string; notice?: string; mode?: string }>;
}) {
  const { next, email, error, notice, mode } = await searchParams;
  const nextPath =
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/auth/") &&
    !next.startsWith("/login") &&
    !next.startsWith("/register")
      ? next
      : "/?tab=step-2";
  const sessionEmail = typeof email === "string" && email.includes("@") ? email : "";
  const startInRegisterMode = mode === "register";

  return (
    <main className="mx-auto min-h-[calc(100dvh-10rem)] max-w-[980px] px-3 py-6 sm:px-4 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-110px] top-[-90px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,_rgba(216,169,96,0.2),_transparent_66%)]" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Login or Create Account</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
          Use one page for sign in and sign up, with Google available in both flows.
        </p>
        {error ? <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className={`space-y-3 rounded-xl border p-3 md:p-4 ${startInRegisterMode ? "border-[var(--color-border)]" : "border-[var(--color-accent)]/65 bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface)_93%)]"}`}>
            <h2 className="text-base font-semibold">Login</h2>
            <form action={loginWithPasswordAction} className="space-y-2">
              <input type="hidden" name="next" value={nextPath} />
              <input
                id="login-email"
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
                placeholder="Password"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2.5 text-sm font-semibold !text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
              >
                Login with Email
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <form action={requestPasswordResetAction} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">Forgot password?</p>
              <input
                name="email"
                type="email"
                required
                defaultValue={sessionEmail}
                placeholder="Email for reset link"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              />
              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]"
              >
                Send reset link
              </button>
            </form>
          </div>
          <div className={`space-y-3 rounded-xl border p-3 md:p-4 ${startInRegisterMode ? "border-[var(--color-accent)]/65 bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface)_93%)]" : "border-[var(--color-border)]"}`}>
            <h2 className="text-base font-semibold">Create Account</h2>
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
                minLength={6}
                placeholder="Password (min 6 characters)"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              />
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="Confirm password"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#f2cd8a] bg-[#e7b566] px-4 py-2.5 text-sm font-semibold !text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:bg-[#f0c57c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2cd8a]/80"
              >
                Create account with Email
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="hidden h-px bg-[var(--color-border)] md:block" />
          <p className="text-center text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">or</p>
          <div className="hidden h-px bg-[var(--color-border)] md:block" />
          <a
            href={`/auth/google/start?next=${encodeURIComponent(nextPath)}`}
            className="md:col-span-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-surface)]"
          >
            <Chrome className="h-4 w-4" />
            Continue with Google
          </a>
        </div>
      </section>
    </main>
  );
}
