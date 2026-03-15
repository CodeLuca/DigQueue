import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SupportInsightCard({
  className,
  detail,
  title,
}: {
  className?: string;
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={cn("rounded border border-[var(--color-border)]/60 bg-[var(--color-surface2)]/45 p-2", className)}>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)]">{title}</p>
      {detail ? <div className="mt-1">{detail}</div> : null}
    </div>
  );
}
