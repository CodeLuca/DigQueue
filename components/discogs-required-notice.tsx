import { ActionLink } from "@/components/action-link";
import { FeedbackBanner } from "@/components/feedback-banner";
import { buildDiscogsConnectPath } from "@/lib/auth-provider-paths";
import {
  getDiscogsRequiredGuidance,
  type DiscogsRequiredGuidanceContext,
} from "@/lib/discogs-required-guidance";

export function DiscogsRequiredNotice({
  context,
  compact = false,
}: {
  context: DiscogsRequiredGuidanceContext;
  compact?: boolean;
}) {
  const guidance = getDiscogsRequiredGuidance(context);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        <p>{guidance.detail}</p>
        <ActionLink href={buildDiscogsConnectPath("/")} variant="textLink" className="text-xs">
          {guidance.actionLabel}
        </ActionLink>
      </div>
    );
  }

  return (
    <FeedbackBanner
      tone="warning"
      className="p-3 text-sm"
      action={(
        <ActionLink href={buildDiscogsConnectPath("/")} variant="textLink" className="inline-block text-xs">
          {guidance.actionLabel}
        </ActionLink>
      )}
    >
      {guidance.detail}
    </FeedbackBanner>
  );
}
