"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SupportText<T extends ElementType = "p">({
  as,
  children,
  className,
  size = "xs",
}: {
  as?: T;
  children: ReactNode;
  className?: string;
  size?: "xs" | "11" | "10";
}) {
  const Component = as ?? "p";

  return (
    <Component
      className={cn(
        size === "10"
          ? "text-[10px] text-[var(--color-muted)]"
          : size === "11"
            ? "text-[11px] text-[var(--color-muted)]"
            : "text-xs text-[var(--color-muted)]",
        className,
      )}
    >
      {children}
    </Component>
  );
}
