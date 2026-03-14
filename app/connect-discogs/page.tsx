export const dynamic = "force-dynamic";

import { ArrowRight } from "lucide-react";
import { ActionLink } from "@/components/action-link";
import { AccountSurface } from "@/components/account-surface";
import { AuthStartLink } from "@/components/auth-start-link";
import { FeedbackBanner } from "@/components/feedback-banner";
import { HighlightActionLink } from "@/components/highlight-action";
import { SupportPanel } from "@/components/support-panel";
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
    <AccountSurface
      title="Connect your Discogs account"
      description="Authenticate once, then DigQueue can pull wants and sync wishlist actions for your Discogs account."
      width="md"
      accent={false}
    >
      {!userId ? (
        <FeedbackBanner tone="error" className="mt-3">
          Login is required before connecting Discogs.
        </FeedbackBanner>
      ) : null}

      <div className="mt-6">
        <SupportPanel title="What will happen">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            <li>Click <span className="mono">Connect Discogs</span>.</li>
            <li>Approve access on Discogs.</li>
            <li>You are redirected back and DigQueue starts wishlist sync.</li>
          </ol>
        </SupportPanel>
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
        <ActionLink href="/login">
          Back: Account step
        </ActionLink>
        <ActionLink href="/">
          Back to current app
        </ActionLink>
      </div>
    </AccountSurface>
  );
}
