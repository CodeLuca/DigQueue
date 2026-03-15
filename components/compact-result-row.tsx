"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CompactResultRow({
  actions,
  className,
  href,
  meta,
  metaClassName,
  rel = "noreferrer",
  target = "_blank",
  title,
  titleClassName,
}: {
  actions?: ReactNode;
  className?: string;
  href?: string;
  meta?: ReactNode;
  metaClassName?: string;
  rel?: string;
  target?: string;
  title: ReactNode;
  titleClassName?: string;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className={cn("line-clamp-1", titleClassName)}>{title}</p>
        {meta ? <p className={cn("line-clamp-1 text-[var(--color-muted)]", metaClassName)}>{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={cn(
          "block rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-surface)]",
          className,
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2 text-xs sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {content}
    </div>
  );
}
