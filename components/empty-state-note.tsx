import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateNoteVariant = "inline" | "card";

export function EmptyStateNote({
  title,
  detail,
  className,
  variant = "inline",
}: {
  title?: ReactNode;
  detail?: ReactNode;
  className?: string;
  variant?: EmptyStateNoteVariant;
}) {
  if (variant === "card") {
    return (
      <div className={cn("rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3", className)}>
        {title ? <p className="text-sm font-medium">{title}</p> : null}
        {detail ? <p className={cn("text-xs text-[var(--color-muted)]", title ? "mt-1" : "text-sm")}>{detail}</p> : null}
      </div>
    );
  }

  return (
    <p className={cn("text-sm text-[var(--color-muted)]", className)}>
      {title ?? detail}
    </p>
  );
}
