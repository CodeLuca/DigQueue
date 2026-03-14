import Link from "next/link";
import type { ReactNode } from "react";

export type ActionLinkVariant = "button" | "compactButton" | "pill" | "textLink" | "iconCircle";

function variantClassName(variant: ActionLinkVariant) {
  switch (variant) {
    case "compactButton":
      return "inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--color-surface)]";
    case "pill":
      return "inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-surface)]";
    case "textLink":
      return "text-sm text-[var(--color-accent)] hover:underline";
    case "iconCircle":
      return "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)] sm:h-9 sm:w-9";
    default:
      return "inline-flex items-center justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-center text-sm hover:bg-[var(--color-surface2)]";
  }
}

export function ActionLink({
  ariaLabel,
  children,
  className,
  href,
  rel,
  target,
  title,
  variant = "button",
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  href: string;
  rel?: string;
  target?: string;
  title?: string;
  variant?: ActionLinkVariant;
}) {
  const resolvedClassName = `${variantClassName(variant)}${className ? ` ${className}` : ""}`;

  if (target || href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={resolvedClassName}
        title={title}
        aria-label={ariaLabel ?? title}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={resolvedClassName} title={title} aria-label={ariaLabel ?? title}>
      {children}
    </Link>
  );
}
