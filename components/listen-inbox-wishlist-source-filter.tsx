"use client";

import { BookmarkCheck, CheckSquare, Disc3 } from "lucide-react";
import { SegmentedControlButton } from "@/components/segmented-control-button";
import type {
  WishlistSourceCounts,
  WishlistSourceFilterValue,
} from "@/lib/listen-inbox-control-types";

export function ListenInboxWishlistSourceFilter({
  counts,
  value,
  onChange,
}: {
  counts: WishlistSourceCounts;
  value: WishlistSourceFilterValue;
  onChange: (next: WishlistSourceFilterValue) => void;
}) {
  const activeMeta =
    value === "saved_tracks"
      ? {
          label: "Saved only",
          description: "Track-level saves only.",
        }
      : value === "wishlisted_records"
        ? {
            label: "Wishlisted only",
            description: "Tracks from Discogs wishlist records only.",
          }
        : {
            label: "All items",
            description: "Saved tracks and wishlisted-record tracks together.",
          };

  return (
    <>
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Source</span>
        <SegmentedControlButton active={value === "all"} tone="compact" onClick={() => onChange("all")}>
          <CheckSquare className="mr-1 inline h-3 w-3" />
          All ({counts.all})
        </SegmentedControlButton>
        <SegmentedControlButton active={value === "saved_tracks"} tone="compact" onClick={() => onChange("saved_tracks")}>
          <Disc3 className="mr-1 inline h-3 w-3" />
          Saved Tracks ({counts.savedTracks})
        </SegmentedControlButton>
        <SegmentedControlButton active={value === "wishlisted_records"} tone="compact" onClick={() => onChange("wishlisted_records")}>
          <BookmarkCheck className="mr-1 inline h-3 w-3" />
          Wishlisted ({counts.wishlistedRecords})
        </SegmentedControlButton>
      </div>
      <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
        <p className="text-xs font-medium">{activeMeta.label} active</p>
        <p className="text-xs text-[var(--color-muted)]">{activeMeta.description}</p>
      </div>
    </>
  );
}
