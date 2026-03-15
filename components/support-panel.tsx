import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SupportPanelProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
  id?: string;
};

export function SupportPanel({
  eyebrow,
  title,
  description,
  status,
  actions,
  className,
  children,
  id,
}: SupportPanelProps) {
  return (
    <section id={id} className={cn("rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4", className)}>
      {eyebrow ? (
        <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          {eyebrow}
        </p>
      ) : null}
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      {status ? <p className={cn("text-sm", title ? "mt-2" : "")}>{status}</p> : null}
      {description ? (
        <p className={cn("text-xs text-[var(--color-muted)]", title || status ? "mt-1" : "")}>{description}</p>
      ) : null}
      {children ? <div className={cn(title || description || status ? "mt-2" : "")}>{children}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}
