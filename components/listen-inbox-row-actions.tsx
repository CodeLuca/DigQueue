"use client";

import type { ReactNode } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCheck,
  CheckCircle2,
  Heart,
  HeartOff,
  Play,
  PlusCircle,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAddSourceFromReleaseActionLabels,
  playNowInMiniPlayerLabel,
  releaseReviewAdvanceLabel,
  trackReviewAdvanceLabel,
} from "@/lib/library-action-labels";

function HoverTooltip({
  children,
  className,
  content,
}: {
  children: ReactNode;
  className?: string;
  content: string;
}) {
  return (
    <span className={`group relative inline-flex ${className ?? ""}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}

export function ListenInboxWishlistAction({
  loading,
  wishlisted,
  onToggle,
  label,
}: {
  loading: boolean;
  wishlisted: boolean;
  onToggle: () => void;
  label: string;
}) {
  const button = (
    <Button
      type="button"
      size="sm"
      variant={wishlisted ? "secondary" : "ghost"}
      disabled={loading}
      className={`h-9 w-9 p-0 ${
        wishlisted
          ? "border border-amber-500/70 bg-amber-500/18 text-black hover:bg-amber-500/28 hover:text-black"
          : "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)] hover:text-white"
      }`}
      onClick={onToggle}
      title={label}
      aria-label={label}
    >
      {wishlisted ? (
        <BookmarkCheck className="h-5 w-5 stroke-[2.35]" />
      ) : (
        <BookmarkPlus className="h-5 w-5 stroke-[2.35]" />
      )}
    </Button>
  );

  return <HoverTooltip content={loading ? "Updating wishlist..." : label}>{button}</HoverTooltip>;
}

export function ListenInboxPlayAction({
  canPlay,
  disabledReason,
  loading,
  onPlay,
  hint,
  className,
}: {
  canPlay: boolean;
  disabledReason: string | null;
  loading: boolean;
  onPlay: () => void;
  hint: string | null;
  className?: string;
}) {
  const tooltip = disabledReason ?? hint;

  return (
    <span
      className={`group relative inline-flex min-w-0 ${canPlay ? "" : "cursor-not-allowed"} ${className ?? ""}`}
      aria-label={tooltip ?? "Play"}
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-full w-full justify-center"
        onClick={onPlay}
        disabled={!canPlay || loading}
        title={playNowInMiniPlayerLabel()}
        aria-label="Play now"
      >
        {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {loading ? "Loading..." : "Play Now"}
      </Button>
      {tooltip ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1.5 text-[11px] leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
            disabledReason
              ? "border border-amber-500/40 bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] text-amber-100"
              : "border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] text-[var(--color-text)]"
          }`}
        >
          {tooltip}
        </span>
      ) : null}
    </span>
  );
}

export function ListenInboxTrackReviewAction({
  onReview,
  iconOnly = false,
}: {
  onReview: () => void;
  iconOnly?: boolean;
}) {
  const title = trackReviewAdvanceLabel();
  const button = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={
        iconOnly
          ? "h-9 w-9 rounded-full border border-emerald-400/60 bg-emerald-500/28 p-0 text-emerald-50 hover:bg-emerald-500/38"
          : "h-10 w-full justify-center rounded-md border border-emerald-400/60 bg-emerald-500/28 text-emerald-50 hover:bg-emerald-500/38"
      }
      onClick={onReview}
      title={title}
      aria-label={title}
    >
      <CheckCircle2 className="h-4 w-4" />
      {iconOnly ? null : "Reviewed"}
    </Button>
  );

  return iconOnly ? <HoverTooltip content={title}>{button}</HoverTooltip> : button;
}

export function ListenInboxReleaseReviewAction({
  loading,
  onReview,
  iconOnly = false,
}: {
  loading: boolean;
  onReview: () => void;
  iconOnly?: boolean;
}) {
  const title = releaseReviewAdvanceLabel();
  const button = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onReview}
      disabled={loading}
      className={
        iconOnly
          ? "h-9 w-9 rounded-full border border-amber-400/60 bg-amber-500/22 p-0 text-black hover:bg-amber-500/32"
          : "h-10 w-full justify-center rounded-md border border-amber-400/60 bg-amber-500/22 text-black hover:bg-amber-500/32"
      }
      title={title}
      aria-label={title}
    >
      {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
      {iconOnly ? null : "Release"}
    </Button>
  );

  return iconOnly ? <HoverTooltip content={title}>{button}</HoverTooltip> : button;
}

export function ListenInboxSaveTrackAction({
  saved,
  title,
  ariaLabel,
  onToggle,
  className,
}: {
  saved: boolean;
  title: string;
  ariaLabel: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={saved ? "secondary" : "ghost"}
      className={`w-full justify-center ${className ?? ""}`}
      onClick={onToggle}
      title={title}
      aria-label={ariaLabel}
    >
      {saved ? (
        <>
          <HeartOff className="h-3.5 w-3.5" />
          Saved
        </>
      ) : (
        <>
          <Heart className="h-3.5 w-3.5" />
          Save Track
        </>
      )}
    </Button>
  );
}

export function ListenInboxAddLabelAction({
  added,
  adding,
  labelIsActive,
  onAdd,
}: {
  added: boolean;
  adding: boolean;
  labelIsActive: boolean;
  onAdd: () => void;
}) {
  const labels = getAddSourceFromReleaseActionLabels(
    labelIsActive ? "active" : adding ? "pending" : added ? "added" : "idle",
  );

  if (labelIsActive) {
    return (
      <span
        className="inline-flex w-full items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 sm:w-[12rem]"
        aria-label={labels.activeAriaLabel}
        title={labels.activeTitle}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {labels.activeButtonLabel}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onAdd}
      disabled={adding || added}
      title={labels.title}
      aria-label={labels.ariaLabel}
      className="w-full justify-center border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] disabled:opacity-100 sm:w-[12rem]"
    >
      <PlusCircle className="h-3.5 w-3.5" />
      {labels.listenButtonLabel}
    </Button>
  );
}
