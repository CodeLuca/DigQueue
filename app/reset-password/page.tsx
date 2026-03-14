import Link from "next/link";
import { AccountSurface } from "@/components/account-surface";
import { FeedbackBanner } from "@/components/feedback-banner";
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
    <AccountSurface
      title="Set a new password"
      description="Choose a new password for your account."
      width="sm"
      accent
    >
      {error ? <FeedbackBanner tone="error" className="mt-3">{error}</FeedbackBanner> : null}
      {notice ? <FeedbackBanner tone="success" className="mt-3">{notice}</FeedbackBanner> : null}

      <div className="mt-6 grid grid-cols-1 gap-3">
        <ResetPasswordForm />
        <Link href="/login" className={tertiaryLinkClass}>
          Back to login
        </Link>
      </div>
    </AccountSurface>
  );
}
