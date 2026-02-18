import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-accentSoft)]",
        className,
      )}
      {...props}
    />
  );
}
