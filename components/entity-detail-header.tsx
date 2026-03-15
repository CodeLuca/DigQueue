import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EntityDetailHeader({
  actions,
  className,
  meta,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  meta?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between", className)}>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--color-muted)]">{subtitle}</p> : null}
        {meta ? <div className="text-xs text-[var(--color-muted)]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
