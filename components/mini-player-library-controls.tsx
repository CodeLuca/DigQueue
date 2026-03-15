"use client";

import type { ReactNode } from "react";
import { BookmarkCheck, BookmarkPlus, Heart, HeartOff, Loader2 } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Button } from "@/components/ui/button";
import {
  getDiscogsWishlistActionLabels,
  getTrackSaveActionLabels,
} from "@/lib/library-action-labels";

function MiniPlayerLibraryIconControl({
  active,
  disabled,
  loading,
  activeLabel,
  inactiveLabel,
  loadingLabel,
  activeIcon,
  inactiveIcon,
  onClick,
  className,
  wrapperClassName = "",
  tooltip = false,
  tooltipClassName,
  activeButtonClassName,
  inactiveButtonClassName,
}: {
  active: boolean;
  disabled: boolean;
  loading: boolean;
  activeLabel: string;
  inactiveLabel: string;
  loadingLabel: string;
  activeIcon: ReactNode;
  inactiveIcon: ReactNode;
  onClick: () => void;
  className: string;
  wrapperClassName?: string;
  tooltip?: boolean;
  tooltipClassName?: string;
  activeButtonClassName?: string;
  inactiveButtonClassName?: string;
}) {
  const button = (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      className={`${className} ${active ? (activeButtonClassName ?? "") : (inactiveButtonClassName ?? "")}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? activeLabel : inactiveLabel}
      title={active ? activeLabel : inactiveLabel}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? activeIcon : inactiveIcon}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <HoverTooltip
      content={loading ? loadingLabel : active ? activeLabel : inactiveLabel}
      className={wrapperClassName}
      tooltipClassName={tooltipClassName ?? ""}
    >
      {button}
    </HoverTooltip>
  );
}

export function MiniPlayerTrackSaveControl(props: {
  saved: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  className: string;
  wrapperClassName?: string;
  tooltip?: boolean;
  tooltipClassName?: string;
}) {
  const labels = getTrackSaveActionLabels(props.saved);

  return (
    <MiniPlayerLibraryIconControl
      active={props.saved}
      disabled={props.disabled}
      loading={props.loading}
      activeLabel={labels.activeLabel}
      inactiveLabel={labels.inactiveLabel}
      loadingLabel="Updating saved track..."
      activeIcon={<HeartOff className="h-3.5 w-3.5" />}
      inactiveIcon={<Heart className="h-3.5 w-3.5" />}
      onClick={props.onClick}
      className={props.className}
      wrapperClassName={props.wrapperClassName}
      tooltip={props.tooltip}
      tooltipClassName={props.tooltipClassName}
    />
  );
}

export function MiniPlayerReleaseWishlistControl(props: {
  wishlisted: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  className: string;
  wrapperClassName?: string;
  tooltip?: boolean;
  tooltipClassName?: string;
}) {
  const labels = getDiscogsWishlistActionLabels(props.wishlisted);

  return (
    <MiniPlayerLibraryIconControl
      active={props.wishlisted}
      disabled={props.disabled}
      loading={props.loading}
      activeLabel={labels.activeLabel}
      inactiveLabel={labels.inactiveLabel}
      loadingLabel="Updating wishlist..."
      activeIcon={<BookmarkCheck className="h-5 w-5 stroke-[2.4]" />}
      inactiveIcon={<BookmarkPlus className="h-5 w-5 stroke-[2.4]" />}
      onClick={props.onClick}
      className={props.className}
      wrapperClassName={props.wrapperClassName}
      tooltip={props.tooltip}
      tooltipClassName={props.tooltipClassName}
      activeButtonClassName="border-amber-500/60 bg-amber-500/15 text-black hover:bg-amber-500/25 hover:text-black"
      inactiveButtonClassName="text-[var(--color-muted)] hover:text-[var(--color-text)]"
    />
  );
}
