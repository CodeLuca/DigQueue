"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { ListenInboxHeaderShell } from "@/components/listen-inbox-header-shell";
import { ListenInboxListShell } from "@/components/listen-inbox-list-shell";
import { Button } from "@/components/ui/button";
import { ListenInboxMobileQuickRail } from "@/components/listen-inbox-mobile-quick-rail";
import {
  useAddSourceFromReleaseAction,
  useReleaseReviewedAction,
  useReleaseWishlistAction,
} from "@/lib/use-library-actions";
import { useTrackTodoClientAction } from "@/lib/use-library-client-actions";
import { applyQueuedTrackIdsToItems } from "@/lib/client-queue-state";
import {
  getLatestQueuedTrackIdsClient,
  subscribeQueuedTrackIdsClient,
} from "@/lib/queued-track-ids-store";
import { useTrackPlaybackRunner } from "@/lib/use-playback-runner";
import { usePlaybackModeState } from "@/lib/playback-mode-client";
import { applyPlayerCurrentToRows } from "@/lib/client-listen-row-state";
import {
  getLatestPlayerCurrentState,
  subscribePlayerCurrentState,
} from "@/lib/player-current-client-store";
import { useClientStoreValue } from "@/lib/use-client-store-value";
import { useListenInboxLibraryActions } from "@/lib/use-listen-inbox-library-actions";
import { useListenInboxLiveSync } from "@/lib/use-listen-inbox-live-sync";
import { useListenInboxMobilePreferences } from "@/lib/use-listen-inbox-mobile-preferences";
import { useListenInboxNavigation } from "@/lib/use-listen-inbox-navigation";
import {
  LISTENING_STATION_PLAYBACK_DISABLED_NOTICE,
  PLAYBACK_DISABLED_NOTICE,
} from "@/lib/playback-action-notices";
import type {
  ListenInboxLabelOption,
  SourceFilter,
  QueueStateView,
  VideoFilter,
  WishlistSourceFilterValue,
} from "@/lib/listen-inbox-control-types";
import type { ListenInboxEmptyState, ListenRow } from "@/lib/listen-inbox-types";
import { useListenInboxPlayback } from "@/lib/use-listen-inbox-playback";

export function ListenInboxClient({
  initialRows,
  initialSelectedLabelId,
  labelOptions,
  emptyState,
  showQueueFilters = true,
  showWishlistSourceFilter = false,
  defaultHideReviewed = true,
  defaultHideAlreadyPlayed = true,
}: {
  initialRows: ListenRow[];
  initialSelectedLabelId?: number;
  labelOptions?: ListenInboxLabelOption[];
  emptyState?: ListenInboxEmptyState;
  showQueueFilters?: boolean;
  showWishlistSourceFilter?: boolean;
  defaultHideReviewed?: boolean;
  defaultHideAlreadyPlayed?: boolean;
}) {
  const [baseRows, setBaseRows] = useState(initialRows);
  const [cursor, setCursor] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(initialSelectedLabelId ?? null);
  const [labelFilterTouched, setLabelFilterTouched] = useState(initialSelectedLabelId != null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [wishlistSourceFilter, setWishlistSourceFilter] = useState<WishlistSourceFilterValue>("all");
  const [hideReviewed, setHideReviewed] = useState(defaultHideReviewed);
  const [hideAlreadyPlayed, setHideAlreadyPlayed] = useState(defaultHideAlreadyPlayed);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [stateView, setStateView] = useState<QueueStateView>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("all");
  const {
    mobileQuickRailCollapsed,
    setMobileQuickRailCollapsed,
    compactMobileRows,
    setCompactMobileRows,
    mobileAutoAdvancePlay,
    setMobileAutoAdvancePlay,
  } = useListenInboxMobilePreferences();
  const { playbackMode, setPlaybackMode } = usePlaybackModeState();
  const playerCurrent = useClientStoreValue(
    subscribePlayerCurrentState,
    () => getLatestPlayerCurrentState() ?? {
      trackId: null,
      queueItemId: null,
      saved: null,
      listened: null,
      playing: false,
    },
  );
  const queuedTrackIds = useClientStoreValue(
    subscribeQueuedTrackIdsClient,
    getLatestQueuedTrackIdsClient,
  );
  const rows = useMemo(() => {
    const queuedRows = applyQueuedTrackIdsToItems(baseRows, queuedTrackIds);
    if (!playerCurrent.trackId) return queuedRows;
    return applyPlayerCurrentToRows(
      queuedRows,
      playerCurrent.trackId,
      playerCurrent.saved ?? undefined,
      playerCurrent.listened ?? undefined,
    );
  }, [baseRows, playerCurrent.listened, playerCurrent.saved, playerCurrent.trackId, queuedTrackIds]);
  const playingTrackId = playerCurrent.trackId;
  const playerIsPlaying = playerCurrent.playing === true;
  const {
    pendingKey: addingLabelReleaseId,
    runAddSource: runAddLabelAction,
  } = useAddSourceFromReleaseAction<number>();
  const {
    pendingKey: wishlistReleaseIdLoading,
    runReleaseWishlist: runWishlistAction,
  } = useReleaseWishlistAction<number>();
  const {
    pendingKey: reviewingReleaseId,
    runReleaseReviewed: runReleaseReviewAction,
  } = useReleaseReviewedAction<number>();
  const runTrackTodoClient = useTrackTodoClientAction();
  const [addedLabelReleaseIds, setAddedLabelReleaseIds] = useState<number[]>([]);
  const {
    youtubeQuotaExceeded,
    setYoutubeQuotaExceeded,
    pendingKey: playbackPendingTrackId,
    runPlayback: runTrackPlayback,
  } = useTrackPlaybackRunner<number>({
    onQuotaExceeded: () => {
      setFeedback((prev) => prev || LISTENING_STATION_PLAYBACK_DISABLED_NOTICE);
    },
    onQuotaCleared: () => {
      setFeedback(null);
    },
  });

  const sourceFilteredRows = useMemo(
    () =>
      rows.filter((item) => {
        if (!showWishlistSourceFilter || wishlistSourceFilter === "all") return true;
        if (wishlistSourceFilter === "saved_tracks") return item.saved;
        return item.releaseWishlist;
      }),
    [rows, showWishlistSourceFilter, wishlistSourceFilter],
  );
  const rowDerivedLabelOptions = useMemo(() => {
    const pairs = new Map<number, string>();
    for (const row of sourceFilteredRows) {
      pairs.set(row.labelId, row.labelName);
    }
    return Array.from(pairs.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name, discogsUrl: undefined } satisfies ListenInboxLabelOption));
  }, [sourceFilteredRows]);
  const effectiveLabelOptions = useMemo(() => {
    // Library view should only list sources that actually have visible items.
    if (!showQueueFilters) return rowDerivedLabelOptions;
    if (!labelOptions || labelOptions.length === 0) return rowDerivedLabelOptions;
    const merged = new Map<number, ListenInboxLabelOption>();
    for (const item of rowDerivedLabelOptions) merged.set(item.id, item);
    for (const item of labelOptions) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [labelOptions, rowDerivedLabelOptions, showQueueFilters]);
  const activeLabelIds = useMemo(() => new Set((labelOptions ?? []).map((item) => item.id)), [labelOptions]);
  const labelIdByTrackId = useMemo(() => {
    const mapped = new Map<number, number>();
    for (const row of rows) mapped.set(row.trackId, row.labelId);
    return mapped;
  }, [rows]);

  const autoSelectedLabelId =
    showQueueFilters && !labelFilterTouched && selectedLabelId === null && playerCurrent.trackId !== null
      ? (labelIdByTrackId.get(playerCurrent.trackId) ?? null)
      : null;
  const effectiveSelectedLabelId = selectedLabelId ?? autoSelectedLabelId;
  const selectedLabelStillExists =
    effectiveSelectedLabelId !== null && effectiveLabelOptions.some((item) => item.id === effectiveSelectedLabelId);
  const activeLabelId = selectedLabelStillExists ? effectiveSelectedLabelId : null;
  const activeLabelIndex = activeLabelId === null ? -1 : effectiveLabelOptions.findIndex((item) => item.id === activeLabelId);
  const activeLabel = activeLabelId === null ? null : effectiveLabelOptions.find((item) => item.id === activeLabelId) ?? null;
  const wishlistScopeRows = useMemo(
    () => (activeLabelId === null ? rows : rows.filter((item) => item.labelId === activeLabelId)),
    [activeLabelId, rows],
  );
  const wishlistSourceCounts = useMemo(() => {
    const savedTracks = wishlistScopeRows.filter((item) => item.saved).length;
    const wishlistedRecords = wishlistScopeRows.filter((item) => item.releaseWishlist).length;
    return { all: wishlistScopeRows.length, savedTracks, wishlistedRecords };
  }, [wishlistScopeRows]);
  const scopedRows = useMemo(
    () => (activeLabelId === null ? sourceFilteredRows : sourceFilteredRows.filter((item) => item.labelId === activeLabelId)),
    [activeLabelId, sourceFilteredRows],
  );
  const queueFilterCounts = useMemo(() => {
    const reviewed = scopedRows.filter((item) => item.listened).length;
    const played = scopedRows.filter((item) => (item.playedCount ?? 0) > 0 || Boolean(item.wasPlayed)).length;
    const needsReview = scopedRows.filter((item) => !item.listened && ((item.playedCount ?? 0) > 0 || Boolean(item.wasPlayed))).length;
    const all = scopedRows.length;
    const saved = scopedRows.filter((item) => item.saved).length;
    const wishlisted = scopedRows.filter((item) => item.releaseWishlist).length;
    const noVideoOrPrivate = scopedRows.filter((item) => !item.hasChosenVideo || item.videoEmbeddable === false).length;
    return { all, reviewed, played, needsReview, saved, wishlisted, noVideoOrPrivate };
  }, [scopedRows]);
  const sourceFilterCounts = useMemo(() => ({
    all: scopedRows.length,
    saved: scopedRows.filter((item) => item.saved).length,
    wishlisted: scopedRows.filter((item) => item.releaseWishlist).length,
    savedOrWishlisted: scopedRows.filter((item) => item.saved || item.releaseWishlist).length,
  }), [scopedRows]);
  const videoFilterCounts = useMemo(() => ({
    all: scopedRows.length,
    playable: scopedRows.filter((item) => item.hasChosenVideo && item.videoEmbeddable !== false).length,
    noVideoOrPrivate: scopedRows.filter((item) => !item.hasChosenVideo || item.videoEmbeddable === false).length,
  }), [scopedRows]);
  const hasAdvancedFiltersActive = sourceFilter !== "all" || videoFilter !== "all" || playbackMode !== "in_order";
  const commuteModeActive =
    showQueueFilters &&
    stateView === "needs_review" &&
    videoFilter === "playable" &&
    hideReviewed &&
    hideAlreadyPlayed &&
    sourceFilter === "all";
  const visibleRows = useMemo(
    () =>
      scopedRows.filter((item) => {
        const hasPlayableVideo = item.hasChosenVideo && item.videoEmbeddable !== false;
        const isNoVideoOrPrivate = !item.hasChosenVideo || item.videoEmbeddable === false;
        if (showQueueFilters) {
          if (sourceFilter === "saved" && !item.saved) return false;
          if (sourceFilter === "wishlisted" && !item.releaseWishlist) return false;
          if (sourceFilter === "saved_or_wishlisted" && !(item.saved || item.releaseWishlist)) return false;
          if (videoFilter === "playable" && !hasPlayableVideo) return false;
          if (videoFilter === "no_video_or_private" && !isNoVideoOrPrivate) return false;
          const alreadyPlayed = (item.playedCount ?? 0) > 0 || Boolean(item.wasPlayed);
          const needsReview = !item.listened && alreadyPlayed;
          if (stateView === "needs_review" && !needsReview) return false;
          if (stateView === "reviewed" && !item.listened) return false;
          if (stateView === "played" && !alreadyPlayed) return false;
          if (hideReviewed && (item.listened || item.saved)) return false;
          if (hideAlreadyPlayed && alreadyPlayed) return false;
        }
        return true;
      }),
    [hideAlreadyPlayed, hideReviewed, scopedRows, showQueueFilters, sourceFilter, stateView, videoFilter],
  );
  const selectedSet = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);
  const selectedVisibleRows = useMemo(
    () => visibleRows.filter((row) => selectedSet.has(row.trackId)),
    [selectedSet, visibleRows],
  );
  const visibleNeedsReviewRows = useMemo(
    () => visibleRows.filter((row) => !row.listened && ((row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed))),
    [visibleRows],
  );
  const scopedTrackIds = useMemo(() => scopedRows.map((row) => row.trackId), [scopedRows]);

  const moveLabel = useCallback((direction: -1 | 1) => {
    if (effectiveLabelOptions.length === 0) {
      setSelectedLabelId(null);
      return;
    }
    setLabelFilterTouched(true);
    setSelectedLabelId((prev) => {
      const currentIndex = prev === null ? 0 : effectiveLabelOptions.findIndex((item) => item.id === prev);
      const safeIndex = currentIndex < 0 ? 0 : currentIndex;
      const nextIndex = (safeIndex + direction + effectiveLabelOptions.length) % effectiveLabelOptions.length;
      return effectiveLabelOptions[nextIndex]?.id ?? null;
    });
    setCursor(0);
  }, [effectiveLabelOptions]);

  const {
    playRow,
    clearYoutubeQuotaExceeded,
  } = useListenInboxPlayback({
    rows,
    runPlayback: runTrackPlayback,
    setBaseRows,
    setFeedback,
    setYoutubeQuotaExceeded,
    youtubeQuotaExceeded,
  });
  const {
    activeCursor,
    current,
    currentCanPlay,
    currentDisabledReason,
    currentPlayHint,
    showMobileQuickRail,
    goPrevVisibleRow,
    goNextVisibleRow,
    canGoPrevVisibleRow,
    canGoNextVisibleRow,
    nextNeedsReviewCursor,
    jumpToNextNeedsReview,
    skipAndPlayNext,
  } = useListenInboxNavigation({
    cursor,
    rowRefs,
    setCursor,
    setFeedback,
    playRow,
    showQueueFilters,
    visibleRows,
    youtubeQuotaExceeded,
  });

  const toggleSelectTrack = useCallback((trackId: number, checked: boolean) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(trackId);
      else next.delete(trackId);
      return [...next];
    });
  }, []);
  const applyCommuteMode = useCallback(() => {
    setStateView("needs_review");
    setVideoFilter("playable");
    setHideReviewed(true);
    setHideAlreadyPlayed(true);
    setSourceFilter("all");
    setCursor(0);
  }, []);
  const resetCommuteMode = useCallback(() => {
    setStateView("all");
    setVideoFilter("all");
    setHideReviewed(false);
    setHideAlreadyPlayed(false);
    setSourceFilter("all");
    setCursor(0);
  }, []);

  const selectVisibleTracks = useCallback(() => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      for (const row of visibleRows) next.add(row.trackId);
      return [...next];
    });
  }, [visibleRows]);

  const clearSelectedTracks = useCallback(() => setSelectedTrackIds([]), []);
  const {
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
  } = useListenInboxLibraryActions({
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
  });

  useListenInboxLiveSync({
    activeLabelId,
    scopedTrackIds,
    setBaseRows,
    showQueueFilters,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;

      if (event.key === "j") {
        event.preventDefault();
        setCursor((prev) => Math.min(visibleRows.length - 1, prev + 1));
      }
      if (event.key === "k") {
        event.preventDefault();
        setCursor((prev) => Math.max(0, prev - 1));
      }
      if (event.key === "d") {
        event.preventDefault();
        void markCurrentListened();
      }
      if (event.key === "w") {
        event.preventDefault();
        void toggleCurrentSaved();
      }
      if (event.key === "p") {
        event.preventDefault();
        if (!youtubeQuotaExceeded && current) void playRow(current.trackId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, markCurrentListened, playRow, toggleCurrentSaved, visibleRows.length, youtubeQuotaExceeded]);

  return (
    <div className={`space-y-3 ${showMobileQuickRail ? (mobileQuickRailCollapsed ? "pb-24" : "pb-36") : "pb-0"} sm:pb-0`}>
      <ListenInboxHeaderShell
        activeLabelDiscogsUrl={activeLabel?.discogsUrl ?? null}
        activeLabelId={activeLabelId}
        activeLabelIndex={activeLabelIndex}
        advancedFiltersOpen={advancedFiltersOpen}
        commuteModeActive={commuteModeActive}
        compactMobileRows={compactMobileRows}
        effectiveLabelOptions={effectiveLabelOptions}
        hasAdvancedFiltersActive={hasAdvancedFiltersActive}
        hideAlreadyPlayed={hideAlreadyPlayed}
        hideReviewed={hideReviewed}
        mobileAutoAdvancePlay={mobileAutoAdvancePlay}
        playbackMode={playbackMode}
        queueFilterCounts={queueFilterCounts}
        selectedCount={selectedVisibleRows.length}
        showQueueFilters={showQueueFilters}
        showWishlistSourceFilter={showWishlistSourceFilter}
        sourceFilter={sourceFilter}
        sourceFilterCounts={sourceFilterCounts}
        stateView={stateView}
        videoFilter={videoFilter}
        videoFilterCounts={videoFilterCounts}
        visibleCount={visibleRows.length}
        visibleNeedsReviewCount={visibleNeedsReviewRows.length}
        wishlistSourceCounts={wishlistSourceCounts}
        wishlistSourceFilter={wishlistSourceFilter}
        onApplyCommuteMode={applyCommuteMode}
        onBulkMarkVisiblePlayedReviewed={() => void bulkMarkVisiblePlayedReviewed()}
        onBulkSetSelectedListened={() => void bulkSetSelectedListened()}
        onBulkSetSelectedSavedFalse={() => void bulkSetSelectedSaved(false)}
        onBulkSetSelectedSavedTrue={() => void bulkSetSelectedSaved(true)}
        onClearSelectedTracks={clearSelectedTracks}
        onMoveLabel={moveLabel}
        onResetCommuteMode={resetCommuteMode}
        onSelectVisibleTracks={selectVisibleTracks}
        onSetActiveLabelId={(next) => {
          setLabelFilterTouched(true);
          setSelectedLabelId(next);
          setCursor(0);
        }}
        onSetAdvancedFiltersOpen={setAdvancedFiltersOpen}
        onSetCompactMobileRows={(next) => setCompactMobileRows(next)}
        onSetHideAlreadyPlayed={(next) => { setHideAlreadyPlayed(next); setCursor(0); }}
        onSetHideReviewed={(next) => { setHideReviewed(next); setCursor(0); }}
        onSetMobileAutoAdvancePlay={(next) => setMobileAutoAdvancePlay(next)}
        onSetPlaybackMode={setPlaybackMode}
        onSetSourceFilter={(next) => { setSourceFilter(next); setCursor(0); }}
        onSetStateView={(next) => { setStateView(next); setCursor(0); }}
        onSetVideoFilter={(next) => { setVideoFilter(next); setCursor(0); }}
        onSetWishlistSourceFilter={(next) => {
          setWishlistSourceFilter(next);
          setCursor(0);
        }}
      />

      {feedback ? <p className="text-xs text-[var(--color-muted)]">{feedback}</p> : null}
      {youtubeQuotaExceeded ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">
          <p>YouTube quota is exhausted. Queue/play controls are disabled until quota reset or key change in Settings.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={clearYoutubeQuotaExceeded}
            title="Retry queue and playback after resetting quota warning"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Retry queue/play
          </Button>
        </div>
      ) : null}
      {showMobileQuickRail && current ? (
        <ListenInboxMobileQuickRail
          activeCursor={activeCursor}
          canGoNextVisibleRow={canGoNextVisibleRow}
          canGoPrevVisibleRow={canGoPrevVisibleRow}
          collapsed={mobileQuickRailCollapsed}
          current={current}
          currentCanPlay={currentCanPlay}
          currentDisabledReason={currentDisabledReason}
          currentPlayHint={currentPlayHint}
          mobileAutoAdvancePlay={mobileAutoAdvancePlay}
          nextNeedsReviewCursor={nextNeedsReviewCursor}
          playbackPendingTrackId={playbackPendingTrackId}
          reviewingReleaseId={reviewingReleaseId}
          visibleRowsLength={visibleRows.length}
          onCollapse={() => setMobileQuickRailCollapsed(true)}
          onExpand={() => setMobileQuickRailCollapsed(false)}
          onGoNextVisibleRow={goNextVisibleRow}
          onGoPrevVisibleRow={goPrevVisibleRow}
          onJumpToNextNeedsReview={jumpToNextNeedsReview}
          onMarkCurrentListened={() => void markCurrentListened()}
          onMarkCurrentReleaseListened={() => void markRowReleaseListened(current.releaseId, current.trackId, current.releaseDiscogsUrl)}
          onPlayCurrent={() => void playRow(current.trackId)}
          onSkipAndPlayNext={skipAndPlayNext}
          onToggleCurrentSaved={() => void toggleCurrentSaved()}
          onToggleMobileAutoAdvancePlay={() => setMobileAutoAdvancePlay((prev) => !prev)}
        />
      ) : null}

      <ListenInboxListShell
        activeCursor={activeCursor}
        activeLabelIds={activeLabelIds}
        addedLabelReleaseIds={addedLabelReleaseIds}
        addingLabelReleaseId={addingLabelReleaseId}
        compactMobileRows={compactMobileRows}
        emptyState={emptyState}
        playbackDisabledNotice={PLAYBACK_DISABLED_NOTICE}
        playbackPendingTrackId={playbackPendingTrackId}
        playerIsPlaying={playerIsPlaying}
        playingTrackId={playingTrackId}
        reviewingReleaseId={reviewingReleaseId}
        rowRefs={rowRefs}
        selectedSet={selectedSet}
        showMobileQuickRail={showMobileQuickRail}
        showQueueFilters={showQueueFilters}
        visibleRows={visibleRows}
        wishlistReleaseIdLoading={wishlistReleaseIdLoading}
        youtubeQuotaExceeded={youtubeQuotaExceeded}
        onAddRowLabel={(releaseId) => void addRowLabel(releaseId)}
        onHoverRow={setCursor}
        onPlayRow={(trackId) => void playRow(trackId)}
        onReviewRelease={(releaseId, trackId, releaseDiscogsUrl) => {
          void markRowReleaseListened(releaseId, trackId, releaseDiscogsUrl);
        }}
        onReviewTrack={(trackId) => void markRowListened(trackId)}
        onSelectCursor={setCursor}
        onSelectTrack={toggleSelectTrack}
        onToggleRowSaved={(trackId) => void toggleRowSaved(trackId)}
        onToggleRowWishlist={(releaseId) => void toggleRowRecordWishlist(releaseId)}
      />
    </div>
  );
}
