import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-accentSoft)] sm:h-9",
        className,
      )}
      {...props}
    />
  );
}
