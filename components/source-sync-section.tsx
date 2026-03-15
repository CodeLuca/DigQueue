import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SourceSyncSection({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  return (
    <details className={cn("mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2", className)}>
      <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-text)]">{title}</summary>
      {children}
    </details>
  );
}
