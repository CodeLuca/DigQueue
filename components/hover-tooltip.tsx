import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type HoverTooltipSize = "compact" | "default" | "wide";
type HoverTooltipTone = "default" | "warning";

export function getHoverTooltipClassName({
  size = "default",
  tone = "default",
}: {
  size?: HoverTooltipSize;
  tone?: HoverTooltipTone;
} = {}) {
  return cn(
    "pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded-md opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
    size === "compact"
      ? "w-max max-w-56 border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)]"
      : size === "wide"
        ? `${tone === "warning" ? "border border-amber-500/40 text-amber-100" : "border border-[var(--color-border)] text-[var(--color-text)]"} w-64 bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug`
        : "hidden w-max max-w-[260px] border border-[var(--color-border)] bg-[var(--color-surface2)] px-2 py-1 text-[11px] leading-tight text-[var(--color-text)] shadow-[var(--shadow-low)] group-hover:block group-focus-within:block",
  );
}

export function HoverTooltip({
  children,
  className,
  content,
  tooltipClassName,
}: {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  tooltipClassName: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span role="tooltip" className={tooltipClassName}>
        {content}
      </span>
    </span>
  );
}
