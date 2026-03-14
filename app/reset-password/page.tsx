import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";

const tertiaryLinkClass =
  "text-sm text-[color:color-mix(in_oklab,var(--color-muted)_82%,var(--color-accent)_18%)] transition-colors hover:text-[var(--color-accent)] hover:underline underline-offset-4";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="mx-auto min-h-[calc(100dvh-10rem)] max-w-[760px] px-3 py-6 sm:px-4 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-low)] reveal sm:p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-110px] top-[-90px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,_rgba(216,169,96,0.2),_transparent_66%)]" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Set a new password</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
          Choose a new password for your account.
        </p>

        {error ? <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-3">
          <ResetPasswordForm />
          <Link href="/login" className={tertiaryLinkClass}>
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
