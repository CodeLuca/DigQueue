import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SourceSyncNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("text-[10px] text-[var(--color-muted)]", className)}>{children}</p>;
}
