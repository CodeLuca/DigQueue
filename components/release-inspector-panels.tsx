import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function getReleaseInspectorPanelClassName(className?: string) {
  return cn(
    "rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3",
    className,
  );
}

export function ReleaseInspectorPanelSection({
  title,
  titleClassName,
  className,
  children,
}: {
  title?: ReactNode;
  titleClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={getReleaseInspectorPanelClassName(className)}>
      {title ? <p className={cn("text-[11px] uppercase tracking-wide text-[var(--color-muted)]", titleClassName)}>{title}</p> : null}
      {children}
    </div>
  );
}

export function ReleaseInspectorMetricCell({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5", className)}>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
