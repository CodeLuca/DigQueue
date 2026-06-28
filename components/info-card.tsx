import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InfoCard({
  description,
  icon: Icon,
  title,
  className,
  descriptionClassName,
  titleClassName,
  variant = "inline",
}: {
  description: ReactNode;
  icon?: LucideIcon;
  title: ReactNode;
  className?: string;
  descriptionClassName?: string;
  titleClassName?: string;
  variant?: "inline" | "stacked";
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        className,
      )}
    >
      {variant === "stacked" ? (
        <>
          {Icon ? <Icon className="mb-3 h-4 w-4 text-[var(--color-accent)]" /> : null}
          <h2 className={cn("text-base font-medium break-words", titleClassName)}>{title}</h2>
        </>
      ) : (
        <p className={cn("inline-flex min-w-0 items-center gap-2 text-sm font-medium", titleClassName)}>
          {Icon ? <Icon className="h-4 w-4 text-[var(--color-accent)]" /> : null}
          {title}
        </p>
      )}
      <p className={cn("mt-2 text-sm text-[var(--color-muted)] break-words", descriptionClassName)}>{description}</p>
    </article>
  );
}
