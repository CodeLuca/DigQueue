import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InsetPanelTone = "surface" | "muted";
type SectionKickerSize = "sm" | "xs";

export function getInsetPanelClassName(tone: InsetPanelTone = "surface") {
  return tone === "muted"
    ? "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 p-2.5"
    : "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3";
}

export function InsetPanel({
  children,
  className,
  tone = "surface",
}: {
  children: ReactNode;
  className?: string;
  tone?: InsetPanelTone;
}) {
  return <div className={cn(getInsetPanelClassName(tone), className)}>{children}</div>;
}

export function SectionKicker({
  children,
  className,
  size = "xs",
}: {
  children: ReactNode;
  className?: string;
  size?: SectionKickerSize;
}) {
  return (
    <p
      className={cn(
        size === "sm"
          ? "text-xs uppercase tracking-wide text-[var(--color-muted)]"
          : "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
