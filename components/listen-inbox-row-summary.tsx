"use client";

import Image from "next/image";
import { BookmarkCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DiscogsLink } from "@/components/discogs-link";
import { ListenInboxWishlistAction } from "@/components/listen-inbox-row-actions";
import {
  getDiscogsWishlistActionLabels,
  releaseDiscogsLinkTitle,
} from "@/lib/library-action-labels";

export type ListenInboxRowSummaryItem = {
  duration?: string | null;
  labelName: string;
  listened: boolean;
  position: string;
  releaseCatno?: string | null;
  releaseDiscogsUrl: string;
  releaseId: number;
  releaseThumbUrl?: string | null;
  releaseTitle: string;
  releaseWishlist: boolean;
  saved: boolean;
  trackArtists?: string | null;
  trackTitle: string;
};

function ReleaseArtwork({
  src,
  title,
  compact = false,
}: {
  src?: string | null;
  title: string;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-12 w-12 rounded-md" : "h-14 w-14 rounded-md";
  if (src) {
    return (
      <Image
        src={src}
        alt={`${title} artwork`}
        width={compact ? 48 : 56}
        height={compact ? 48 : 56}
        className={`${sizeClass} shrink-0 border border-[var(--color-border)] object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)]`} aria-hidden />
  );
}

export function ListenInboxRowSummary({
  isPlaying,
  isUpNext,
  item,
  mobileCompactRow,
  needsMark,
  playedCount,
  showWishlistAction,
  toggleWishlistLoading,
  wasPlayed,
  onToggleWishlist,
}: {
  isPlaying: boolean;
  isUpNext: boolean;
  item: ListenInboxRowSummaryItem;
  mobileCompactRow: boolean;
  needsMark: boolean;
  playedCount: number;
  showWishlistAction: boolean;
  toggleWishlistLoading: boolean;
  wasPlayed: boolean;
  onToggleWishlist: () => void;
}) {
  const artistLine = (item.trackArtists || "").trim();
  const wishlistLabels = getDiscogsWishlistActionLabels(item.releaseWishlist, "record");

  return (
    <div className={`flex min-w-0 items-center ${mobileCompactRow ? "gap-2" : "gap-3"}`}>
      {!mobileCompactRow ? <ReleaseArtwork src={item.releaseThumbUrl} title={item.releaseTitle} /> : null}
      <div className="min-w-0">
        {artistLine ? (
          <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{artistLine}</p>
        ) : null}
        <p className={`${mobileCompactRow ? "line-clamp-1 text-[13px]" : "line-clamp-2 text-sm"} font-medium leading-snug`}>
          {item.position} {item.trackTitle}
          <DiscogsLink
            className="ml-1"
            discogsUrl={item.releaseDiscogsUrl}
            title={releaseDiscogsLinkTitle()}
            variant="inlineIcon"
          />
        </p>
        <div className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)] ${mobileCompactRow ? "sm:flex" : ""}`}>
          <span>{item.labelName}</span>
          <span>•</span>
          <a className="underline-offset-2 hover:underline" href={`/releases/${item.releaseId}`}>
            {item.releaseTitle}
            {item.releaseCatno ? <span className="ml-1 text-[var(--color-muted)]">({item.releaseCatno})</span> : null}
          </a>
          {showWishlistAction ? (
            <span className="ml-1 inline-flex">
              <ListenInboxWishlistAction
                loading={toggleWishlistLoading}
                wishlisted={item.releaseWishlist}
                onToggle={onToggleWishlist}
                label={wishlistLabels.ariaLabel}
              />
            </span>
          ) : null}
          {item.duration ? (
            <>
              <span>•</span>
              <span>{item.duration}</span>
            </>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {isPlaying ? <Badge className="border-emerald-600/50 text-emerald-300">Now Playing</Badge> : null}
          {isUpNext ? <Badge className="border-blue-600/50 text-blue-300">Up Next</Badge> : null}
          {item.listened ? <Badge className="border-cyan-600/50 text-cyan-300">Reviewed</Badge> : null}
          {needsMark ? <Badge className="border-amber-600/50 text-amber-300">Needs Review</Badge> : null}
          {!mobileCompactRow ? (
            <>
              {item.saved ? <Badge className="border-fuchsia-600/50 text-fuchsia-300">Track Saved</Badge> : null}
              {item.releaseWishlist ? (
                <Badge className="border-amber-500/60 bg-amber-500/15 text-amber-200">
                  <BookmarkCheck className="mr-1 h-3 w-3" />
                  Wishlisted
                </Badge>
              ) : null}
              {wasPlayed ? <Badge className="border-zinc-600/50 text-zinc-300">Played{playedCount > 1 ? ` x${playedCount}` : ""}</Badge> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
