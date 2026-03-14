"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type SegmentedControlTone = "default" | "compact";

function segmentedControlClass(active: boolean, tone: SegmentedControlTone, className?: string) {
  const toneClassName =
    tone === "compact"
      ? active
        ? "min-h-8 px-2 py-1 font-medium border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-surface2)_76%)] text-[var(--color-text)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
        : "min-h-8 px-2 py-1 font-medium border-[var(--color-border)] bg-[var(--color-surface)]/55 text-[var(--color-muted)] opacity-90 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      : active
        ? "min-h-9 px-3 py-1.5 text-sm border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
        : "min-h-9 px-3 py-1.5 text-sm border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]";

  return `inline-flex items-center rounded-md border ${toneClassName}${className ? ` ${className}` : ""}`;
}

export function SegmentedControlButton({
  active,
  ariaPressed,
  children,
  className,
  onClick,
  tone = "default",
  type = "button",
}: {
  active: boolean;
  ariaPressed?: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
  tone?: SegmentedControlTone;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      className={segmentedControlClass(active, tone, className)}
      onClick={onClick}
      aria-pressed={ariaPressed ?? active}
    >
      {children}
    </button>
  );
}

export function SegmentedControlLink({
  active,
  children,
  className,
  href,
  title,
  tone = "default",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  href: string;
  title?: string;
  tone?: SegmentedControlTone;
}) {
  return (
    <Link href={href} className={segmentedControlClass(active, tone, className)} title={title}>
      {children}
    </Link>
  );
}
