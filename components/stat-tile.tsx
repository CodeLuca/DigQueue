import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon,
  action,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        {icon}
        {label}
      </p>
      <p className="text-xl font-semibold">{value}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
