import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FeedbackBannerTone = "success" | "error" | "warning";
type FeedbackBannerEmphasis = "soft" | "gradient";

function getFeedbackBannerToneClassName(tone: FeedbackBannerTone, emphasis: FeedbackBannerEmphasis) {
  if (tone === "success") {
    return emphasis === "gradient"
      ? "border-emerald-500/50 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(16,185,129,0.08))] text-emerald-200"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "warning") {
    return emphasis === "gradient"
      ? "border-amber-500/50 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(245,158,11,0.08))] text-amber-100"
      : "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }
  return emphasis === "gradient"
    ? "border-rose-500/50 bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(244,63,94,0.06))] text-rose-200"
    : "border-red-500/40 bg-red-500/10 text-red-200";
}

export function FeedbackBanner({
  tone,
  title,
  emphasis = "soft",
  className,
  children,
  action,
}: {
  tone: FeedbackBannerTone;
  title?: ReactNode;
  emphasis?: FeedbackBannerEmphasis;
  className?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-sm", getFeedbackBannerToneClassName(tone, emphasis), className)}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title ? "mt-1" : "")}>{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
