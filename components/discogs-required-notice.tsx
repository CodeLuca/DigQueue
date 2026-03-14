import Link from "next/link";
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
        <Link href={buildDiscogsConnectPath("/")} className="text-[var(--color-accent)] hover:underline">
          {guidance.actionLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="text-amber-200">{guidance.detail}</p>
      <Link href={buildDiscogsConnectPath("/")} className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline">
        {guidance.actionLabel}
      </Link>
    </div>
  );
}
