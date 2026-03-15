"use client";

import type { ReactNode } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Button } from "@/components/ui/button";
import { ExternalActionLink } from "@/components/external-action-link";

export function MiniPlayerTooltipControl({
  tooltip,
  children,
  wrapperClassName = "",
  tooltipClassName,
}: {
  tooltip: ReactNode;
  children: ReactNode;
  wrapperClassName?: string;
  tooltipClassName: string;
}) {
  return (
    <HoverTooltip content={tooltip} className={wrapperClassName} tooltipClassName={tooltipClassName}>
      {children}
    </HoverTooltip>
  );
}

export function MiniPlayerIconButtonControl({
  tooltip,
  tooltipClassName,
  wrapperClassName,
  ...buttonProps
}: {
  tooltip: ReactNode;
  tooltipClassName: string;
  wrapperClassName?: string;
  children: ReactNode;
  className: string;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  variant?: "ghost" | "secondary" | "outline";
}) {
  return (
    <MiniPlayerTooltipControl
      tooltip={tooltip}
      wrapperClassName={wrapperClassName}
      tooltipClassName={tooltipClassName}
    >
      <Button
        type="button"
        size="sm"
        variant={buttonProps.variant ?? "ghost"}
        className={buttonProps.className}
        onClick={buttonProps.onClick}
        disabled={buttonProps.disabled}
        title={buttonProps.title}
        aria-label={buttonProps.ariaLabel}
      >
        {buttonProps.children}
      </Button>
    </MiniPlayerTooltipControl>
  );
}

export function MiniPlayerExternalIconControl({
  href,
  tooltip,
  tooltipClassName,
  wrapperClassName,
  title,
  ariaLabel,
  children,
}: {
  href: string;
  tooltip: ReactNode;
  tooltipClassName: string;
  wrapperClassName?: string;
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <MiniPlayerTooltipControl
      tooltip={tooltip}
      wrapperClassName={wrapperClassName}
      tooltipClassName={tooltipClassName}
    >
      <ExternalActionLink
        href={href}
        title={title}
        ariaLabel={ariaLabel}
        variant="iconCircle"
      >
        {children}
      </ExternalActionLink>
    </MiniPlayerTooltipControl>
  );
}
