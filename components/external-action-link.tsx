import type { ReactNode } from "react";

type ExternalActionLinkVariant = "button" | "compactButton" | "pill" | "textLink" | "iconCircle";

function variantClassName(variant: ExternalActionLinkVariant) {
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
      return "inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-border)] px-3 text-xs hover:bg-[var(--color-surface2)] sm:justify-start";
  }
}

export function ExternalActionLink({
  ariaLabel,
  children,
  className,
  href,
  rel = "noreferrer",
  target = "_blank",
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
  variant?: ExternalActionLinkVariant;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`${variantClassName(variant)}${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={ariaLabel ?? title}
    >
      {children}
    </a>
  );
}
