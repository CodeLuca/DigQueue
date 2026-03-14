import { Chrome } from "lucide-react";
import { AccountSurface } from "@/components/account-surface";
import { AuthStartLink } from "@/components/auth-start-link";
import { FeedbackBanner } from "@/components/feedback-banner";
import { LoginPasswordForm } from "@/components/login-password-form";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";
import { RegisterPasswordForm } from "@/components/register-password-form";

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
    <AccountSurface
      title="Login or Create Account"
      description="Use one page for sign in and sign up, with Google available in both flows."
      width="lg"
      accent
    >
      {error ? <FeedbackBanner tone="error" className="mt-3">{error}</FeedbackBanner> : null}
      {notice ? <FeedbackBanner tone="success" className="mt-3">{notice}</FeedbackBanner> : null}

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className={`space-y-3 rounded-xl border p-3 md:p-4 ${startInRegisterMode ? "border-[var(--color-border)]" : "border-[var(--color-accent)]/65 bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface)_93%)]"}`}>
          <h2 className="text-base font-semibold">Login</h2>
          <LoginPasswordForm nextPath={nextPath} defaultEmail={sessionEmail} />
          <PasswordResetRequestForm defaultEmail={sessionEmail} />
        </div>
        <div className={`space-y-3 rounded-xl border p-3 md:p-4 ${startInRegisterMode ? "border-[var(--color-accent)]/65 bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface)_93%)]" : "border-[var(--color-border)]"}`}>
          <h2 className="text-base font-semibold">Create Account</h2>
          <RegisterPasswordForm nextPath={nextPath} defaultEmail={sessionEmail} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="hidden h-px bg-[var(--color-border)] md:block" />
        <p className="text-center text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">or</p>
        <div className="hidden h-px bg-[var(--color-border)] md:block" />
        <AuthStartLink
          provider="google"
          nextPath={nextPath}
          className="md:col-span-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-surface)]"
        >
          <Chrome className="h-4 w-4" />
          Continue with Google
        </AuthStartLink>
      </div>
    </AccountSurface>
  );
}
