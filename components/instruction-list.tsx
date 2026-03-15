import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InstructionList({
  className,
  items,
}: {
  className?: string;
  items: ReactNode[];
}) {
  return (
    <ol className={cn("list-decimal space-y-1 pl-5 text-xs text-[var(--color-muted)]", className)}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}
