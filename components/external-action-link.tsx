import type { ReactNode } from "react";
import { ActionLink, type ActionLinkVariant } from "@/components/action-link";

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
  variant?: ActionLinkVariant;
}) {
  return (
    <ActionLink
      href={href}
      target={target}
      rel={rel}
      className={className}
      title={title}
      ariaLabel={ariaLabel}
      variant={variant}
    >
      {children}
    </ActionLink>
  );
}
