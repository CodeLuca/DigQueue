"use client";

import type { ReactNode } from "react";
import { Disc3, ExternalLink } from "lucide-react";
import { ExternalActionLink } from "@/components/external-action-link";
import { ResponsiveLabel } from "@/components/responsive-label";
import { toDiscogsWebUrl } from "@/lib/discogs-links";

type DiscogsLinkVariant = "iconButton" | "inlineIcon" | "textButton" | "textLink";

export function DiscogsLink({
  children,
  className,
  discogsUrl,
  label,
  title,
  variant = "iconButton",
}: {
  children?: ReactNode;
  className?: string;
  discogsUrl: string;
  label?: ReactNode;
  title?: string;
  variant?: DiscogsLinkVariant;
}) {
  const href = toDiscogsWebUrl(discogsUrl, "");
  const resolvedTitle = title ?? "Open on Discogs";
  const resolvedLabel =
    typeof label !== "undefined"
      ? label
      : variant === "textButton"
        ? "Discogs"
        : variant === "textLink"
          ? "Open on Discogs"
        : resolvedTitle;
  const variantClassName =
    variant === "inlineIcon"
      ? "inline-flex align-middle text-[var(--color-muted)] hover:text-[var(--color-text)]"
      : variant === "iconButton"
        ? "rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
        : "";

  if (variant === "textButton" || variant === "textLink") {
    return (
      <ExternalActionLink
        href={href}
        title={resolvedTitle}
        ariaLabel={typeof resolvedLabel === "string" ? resolvedLabel : resolvedTitle}
        variant={variant === "textButton" ? "compactButton" : "textLink"}
        className={className}
      >
        {children ? children : variant === "textButton" ? (
          <ResponsiveLabel compact="Open" full={resolvedLabel} />
        ) : (
          "Open on Discogs"
        )}
      </ExternalActionLink>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${variantClassName}${className ? ` ${className}` : ""}`}
      title={resolvedTitle}
      aria-label={typeof resolvedLabel === "string" ? resolvedLabel : resolvedTitle}
    >
      {children ? children : variant === "inlineIcon" ? (
        <Disc3 className="h-3.5 w-3.5" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" />
      )}
    </a>
  );
}
