import Link from "next/link";
import { Chrome } from "lucide-react";
import { AccountSurface } from "@/components/account-surface";
import { AuthStartLink } from "@/components/auth-start-link";
import { FeedbackBanner } from "@/components/feedback-banner";
import { RegisterPasswordForm } from "@/components/register-password-form";

function resolveNextPath(value: string | undefined) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/auth/") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
    ? value
    : "/";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; error?: string; notice?: string }>;
}) {
  const { next, email, error, notice } = await searchParams;
  const nextPath = resolveNextPath(next);
  const sessionEmail = typeof email === "string" && email.includes("@") ? email : "";

  return (
    <AccountSurface
      title="Create your DigQueue account"
      description="Start with an email login, then connect Discogs from the app when you are ready to load sources."
      width="md"
      accent
    >
      {error ? <FeedbackBanner tone="error" className="mt-3">{error}</FeedbackBanner> : null}
      {notice ? <FeedbackBanner tone="success" className="mt-3">{notice}</FeedbackBanner> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_0.75fr]">
        <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/65 bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface)_93%)] p-3 md:p-4">
          <h2 className="text-base font-semibold">Create Account</h2>
          <RegisterPasswordForm nextPath={nextPath} defaultEmail={sessionEmail} />
        </div>
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-3 md:p-4">
          <h2 className="text-base font-semibold">Already have an account?</h2>
          <p className="text-sm text-[var(--color-muted)]">Log in and continue where you left off.</p>
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface)]"
          >
            Login instead
          </Link>
          <AuthStartLink
            provider="google"
            nextPath={nextPath}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]"
          >
            <Chrome className="h-4 w-4" />
            Continue with Google
          </AuthStartLink>
        </div>
      </div>
    </AccountSurface>
  );
}
