"use client";

import { useCallback } from "react";
import { dispatchPlaybackNextEvent } from "@/lib/client-playback-events";
import {
  applyAffectedReleaseWishlistToRows,
  applyLabelActiveToRows,
  applyListenedToRows,
  applyReleaseWishlistToRows,
  applySavedToRows,
  filterSavedRows,
} from "@/lib/client-listen-row-state";
import {
  addingLabelNotice,
  bulkReviewedPlayedTracksNotice,
  bulkReviewedTracksNotice,
  bulkSavedTracksNotice,
  labelAddedAndActivatedNotice,
  libraryAddSourceError,
  libraryRecordWishlistError,
  libraryReleaseReviewedError,
  releaseWishlistNotice,
  reviewedReleaseEndOfQueueNotice,
} from "@/lib/library-action-notices";
import type { ReleaseWishlistResponse } from "@/lib/release-library-contract";
import type { ListenRow } from "@/lib/listen-inbox-types";

type TrackTodoUpdate = {
  trackId: number;
  saved: boolean;
  listened: boolean;
};

type RunTrackTodoClient = (payload: {
  trackIds: number[];
  field: "listened" | "saved";
  mode: "set" | "toggle";
  value?: boolean;
}) => Promise<TrackTodoUpdate[]>;

type RunReleaseReviewAction = (
  key: number,
  releaseId: number,
  options?: {
    successMessage?: string | null;
    onSuccess?: (tracks: unknown) => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
    mapError?: (error: unknown) => string | null;
  },
) => Promise<unknown>;

type WishlistResult = Pick<
  ReleaseWishlistResponse,
  "affectedReleaseIds" | "affectedTrackCount" | "discogsSynced" | "localConfirmedAll" | "wishlist"
>;

type RunWishlistAction = (
  key: number,
  payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean },
  options?: {
    successMessage?: string | null;
    onSuccess?: (result: WishlistResult) => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
    mapError?: (error: unknown) => string | null;
  },
) => Promise<unknown>;

type RunAddLabelAction = (
  key: number,
  releaseId: number,
  options?: {
    successMessage?: string | null;
    onSuccess?: () => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
    mapError?: (error: unknown) => string | null;
  },
) => Promise<unknown>;

export function useListenInboxLibraryActions({
  addedLabelReleaseIds,
  addingLabelReleaseId,
  current,
  mobileAutoAdvancePlay,
  playRow,
  playingTrackId,
  reviewingReleaseId,
  rows,
  runAddLabelAction,
  runReleaseReviewAction,
  runTrackTodoClient,
  runWishlistAction,
  selectedVisibleRows,
  setAddedLabelReleaseIds,
  setBaseRows,
  setCursor,
  setFeedback,
  setSelectedTrackIds,
  showMobileQuickRail,
  showQueueFilters,
  visibleNeedsReviewRows,
  visibleRows,
  wishlistReleaseIdLoading,
}: {
  addedLabelReleaseIds: number[];
  addingLabelReleaseId: number | null;
  current: ListenRow | null;
  mobileAutoAdvancePlay: boolean;
  playRow: (trackId: number) => Promise<void>;
  playingTrackId: number | null;
  reviewingReleaseId: number | null;
  rows: ListenRow[];
  runAddLabelAction: RunAddLabelAction;
  runReleaseReviewAction: RunReleaseReviewAction;
  runTrackTodoClient: RunTrackTodoClient;
  runWishlistAction: RunWishlistAction;
  selectedVisibleRows: ListenRow[];
  setAddedLabelReleaseIds: React.Dispatch<React.SetStateAction<number[]>>;
  setBaseRows: React.Dispatch<React.SetStateAction<ListenRow[]>>;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  setFeedback: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTrackIds: React.Dispatch<React.SetStateAction<number[]>>;
  showMobileQuickRail: boolean;
  showQueueFilters: boolean;
  visibleNeedsReviewRows: ListenRow[];
  visibleRows: ListenRow[];
  wishlistReleaseIdLoading: number | null;
}) {
  const markCurrentListened = useCallback(async () => {
    if (!current) return;
    const wasPlaying = current.trackId === playingTrackId;
    const shouldAutoAdvancePlay = wasPlaying || (showMobileQuickRail && mobileAutoAdvancePlay);
    const activeIndex = visibleRows.findIndex((row) => row.trackId === current.trackId);
    const nextTrackId = activeIndex >= 0
      ? (visibleRows[activeIndex + 1]?.trackId ?? visibleRows[activeIndex - 1]?.trackId ?? null)
      : null;
    await runTrackTodoClient({ trackIds: [current.trackId], field: "listened", mode: "set", value: true });
    setBaseRows((prev) => {
      const next = applyListenedToRows(prev, [current.trackId]);
      setCursor(() => {
        if (nextTrackId !== null) {
          const nextIndex = next.findIndex((row) => row.trackId === nextTrackId);
          if (nextIndex >= 0) return nextIndex;
        }
        const currentIndex = next.findIndex((row) => row.trackId === current.trackId);
        return Math.max(0, Math.min(currentIndex >= 0 ? currentIndex : 0, Math.max(0, next.length - 1)));
      });
      return next;
    });
    if (shouldAutoAdvancePlay && nextTrackId) {
      void playRow(nextTrackId);
    } else if (wasPlaying) {
      dispatchPlaybackNextEvent();
    }
  }, [current, mobileAutoAdvancePlay, playRow, playingTrackId, runTrackTodoClient, setBaseRows, setCursor, showMobileQuickRail, visibleRows]);

  const toggleCurrentSaved = useCallback(async () => {
    if (!current) return;
    const updated = await runTrackTodoClient({ trackIds: [current.trackId], field: "saved", mode: "toggle" });
    const nextSaved = updated.find((item) => item.trackId === current.trackId)?.saved ?? current.saved;
    setBaseRows((prev) => {
      const next = applySavedToRows(prev, [current.trackId], nextSaved);
      return showQueueFilters ? next : filterSavedRows(next);
    });
  }, [current, runTrackTodoClient, setBaseRows, showQueueFilters]);

  const markRowListened = useCallback(async (trackId: number) => {
    const wasPlaying = trackId === playingTrackId;
    const rowIndex = visibleRows.findIndex((item) => item.trackId === trackId);
    const nextTrackId = rowIndex >= 0
      ? (visibleRows[rowIndex + 1]?.trackId ?? visibleRows[rowIndex - 1]?.trackId ?? null)
      : null;
    await runTrackTodoClient({ trackIds: [trackId], field: "listened", mode: "set", value: true });
    setBaseRows((prev) => {
      const next = applyListenedToRows(prev, [trackId]);
      setCursor((cursorPrev) => {
        if (nextTrackId !== null) {
          const nextIndex = next.findIndex((row) => row.trackId === nextTrackId);
          if (nextIndex >= 0) return nextIndex;
        }
        return Math.max(0, Math.min(cursorPrev, Math.max(0, next.length - 1)));
      });
      return next;
    });
    if (wasPlaying && nextTrackId) {
      void playRow(nextTrackId);
    } else if (wasPlaying) {
      dispatchPlaybackNextEvent();
    }
  }, [playRow, playingTrackId, runTrackTodoClient, setBaseRows, setCursor, visibleRows]);

  const markRowReleaseListened = useCallback(async (releaseId: number, trackId: number, releaseDiscogsUrl: string) => {
    if (reviewingReleaseId === releaseId) return;
    const normalizedReleaseUrl = releaseDiscogsUrl.trim().toLowerCase();
    const releaseGroupRows = visibleRows.filter((row) => row.releaseDiscogsUrl.trim().toLowerCase() === normalizedReleaseUrl);
    const targetTrackIds = [...new Set((releaseGroupRows.length > 0 ? releaseGroupRows : [{ trackId }]).map((row) => row.trackId))];
    const targetTrackIdSet = new Set(targetTrackIds);
    const wasPlayingRelease = playingTrackId !== null && targetTrackIdSet.has(playingTrackId);
    const shouldAutoAdvancePlay = wasPlayingRelease || (showMobileQuickRail && mobileAutoAdvancePlay);
    const rowIndex = visibleRows.findIndex((row) => row.trackId === trackId);
    let nextTrackId: number | null = null;
    if (rowIndex >= 0) {
      for (let i = rowIndex + 1; i < visibleRows.length; i += 1) {
        if (!targetTrackIdSet.has(visibleRows[i]?.trackId ?? -1)) {
          nextTrackId = visibleRows[i]?.trackId ?? null;
          break;
        }
      }
    }
    await runReleaseReviewAction(releaseId, releaseId, {
      onSuccess: () => {
        setBaseRows((prev) => {
          const next = applyListenedToRows(prev, targetTrackIdSet);
          const nextRows = showQueueFilters ? next : filterSavedRows(next);
          setCursor((cursorPrev) => {
            if (nextTrackId !== null) {
              const nextIndex = nextRows.findIndex((row) => row.trackId === nextTrackId);
              if (nextIndex >= 0) return nextIndex;
            }
            return Math.max(0, Math.min(cursorPrev, Math.max(0, nextRows.length - 1)));
          });
          return nextRows;
        });
        if (!nextTrackId) {
          setFeedback(reviewedReleaseEndOfQueueNotice());
        }
        if (shouldAutoAdvancePlay && nextTrackId) {
          void playRow(nextTrackId);
        } else if (wasPlayingRelease) {
          dispatchPlaybackNextEvent();
        }
      },
      mapError: libraryReleaseReviewedError,
    });
  }, [mobileAutoAdvancePlay, playRow, playingTrackId, reviewingReleaseId, runReleaseReviewAction, setBaseRows, setCursor, setFeedback, showMobileQuickRail, showQueueFilters, visibleRows]);

  const toggleRowSaved = useCallback(async (trackId: number) => {
    const updated = await runTrackTodoClient({ trackIds: [trackId], field: "saved", mode: "toggle" });
    const updatedTrack = updated.find((item) => item.trackId === trackId);
    if (!updatedTrack) return;
    setBaseRows((prev) => {
      const next = applySavedToRows(prev, [trackId], updatedTrack.saved);
      return showQueueFilters ? next : filterSavedRows(next);
    });
  }, [runTrackTodoClient, setBaseRows, showQueueFilters]);

  const toggleRowRecordWishlist = useCallback(async (releaseId: number) => {
    if (wishlistReleaseIdLoading === releaseId) return;
    const currentValue = rows.find((row) => row.releaseId === releaseId)?.releaseWishlist ?? false;
    const nextWishlist = !currentValue;
    setBaseRows((prev) => applyReleaseWishlistToRows(prev, releaseId, nextWishlist));
    await runWishlistAction(releaseId, { releaseId, mode: "set", value: nextWishlist }, {
      onSuccess: (result) => {
        setBaseRows((prev) => applyAffectedReleaseWishlistToRows(prev, result.affectedReleaseIds, result.wishlist));
        setFeedback(releaseWishlistNotice(result));
      },
      onError: () => {
        setBaseRows((prev) => applyReleaseWishlistToRows(prev, releaseId, currentValue));
      },
      mapError: libraryRecordWishlistError,
    });
  }, [rows, runWishlistAction, setBaseRows, setFeedback, wishlistReleaseIdLoading]);

  const addRowLabel = useCallback(async (releaseId: number) => {
    if (addingLabelReleaseId === releaseId) return;
    if (addedLabelReleaseIds.includes(releaseId)) return;
    setFeedback(addingLabelNotice());
    await runAddLabelAction(releaseId, releaseId, {
      successMessage: labelAddedAndActivatedNotice(),
      onSuccess: () => {
        setBaseRows((prev) => applyLabelActiveToRows(prev, releaseId, true));
        setAddedLabelReleaseIds((prev) => (prev.includes(releaseId) ? prev : [...prev, releaseId]));
      },
      mapError: libraryAddSourceError,
    });
  }, [addedLabelReleaseIds, addingLabelReleaseId, runAddLabelAction, setAddedLabelReleaseIds, setBaseRows, setFeedback]);

  const bulkSetSelectedListened = useCallback(async () => {
    const eligible = selectedVisibleRows.filter((row) => row.importSource !== "discogs_want").map((row) => row.trackId);
    if (eligible.length === 0) return;
    await runTrackTodoClient({ trackIds: eligible, field: "listened", mode: "set", value: true });
    setBaseRows((prev) => applyListenedToRows(prev, eligible));
    setSelectedTrackIds((prev) => prev.filter((id) => !eligible.includes(id)));
    setFeedback(bulkReviewedTracksNotice(eligible.length));
  }, [runTrackTodoClient, selectedVisibleRows, setBaseRows, setFeedback, setSelectedTrackIds]);

  const bulkSetSelectedSaved = useCallback(async (value: boolean) => {
    const ids = selectedVisibleRows.map((row) => row.trackId);
    if (ids.length === 0) return;
    await runTrackTodoClient({ trackIds: ids, field: "saved", mode: "set", value });
    setBaseRows((prev) => {
      const next = applySavedToRows(prev, ids, value);
      return showQueueFilters ? next : filterSavedRows(next);
    });
    setSelectedTrackIds((prev) => prev.filter((id) => !ids.includes(id)));
    setFeedback(bulkSavedTracksNotice(ids.length, value));
  }, [runTrackTodoClient, selectedVisibleRows, setBaseRows, setFeedback, setSelectedTrackIds, showQueueFilters]);

  const bulkMarkVisiblePlayedReviewed = useCallback(async () => {
    const ids = visibleNeedsReviewRows.map((row) => row.trackId);
    if (ids.length === 0) return;
    await runTrackTodoClient({ trackIds: ids, field: "listened", mode: "set", value: true });
    setBaseRows((prev) => applyListenedToRows(prev, ids));
    setSelectedTrackIds((prev) => prev.filter((id) => !ids.includes(id)));
    setFeedback(bulkReviewedPlayedTracksNotice(ids.length));
  }, [runTrackTodoClient, setBaseRows, setFeedback, setSelectedTrackIds, visibleNeedsReviewRows]);

  return {
    markCurrentListened,
    toggleCurrentSaved,
    markRowListened,
    markRowReleaseListened,
    toggleRowSaved,
    toggleRowRecordWishlist,
    addRowLabel,
    bulkSetSelectedListened,
    bulkSetSelectedSaved,
    bulkMarkVisiblePlayedReviewed,
  };
}
