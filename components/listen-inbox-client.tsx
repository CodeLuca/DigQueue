"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Disc3,
  ExternalLink,
  Heart,
  HeartOff,
  ListOrdered,
  Play,
  PlusCircle,
  RefreshCcw,
  Shuffle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enqueueTrackForClient } from "@/lib/client-queue";
import {
  LISTENING_SCOPE_EVENT,
  PLAY_ITEM_EVENT,
  PLAYBACK_MODE_EVENT,
  PLAYBACK_NEXT_EVENT,
  PLAYBACK_MODE_STORAGE_KEY,
  PLAYER_CURRENT_EVENT,
  RELEASE_WISHLIST_UPDATED_EVENT,
  REQUEST_PLAYER_CURRENT_EVENT,
  TRACK_TODO_UPDATED_EVENT,
  YOUTUBE_QUOTA_CLEAR_EVENT,
  YOUTUBE_QUOTA_EVENT,
} from "@/lib/client-events";
import { toDiscogsWebUrl } from "@/lib/discogs-links";
import {
  clearYouTubeQuotaExceededInSession,
  isYouTubeQuotaExceededInSession,
  setYouTubeQuotaExceededInSession,
} from "@/lib/youtube-quota-client";
import { QUEUE_ERROR_NO_MATCH, QUEUE_ERROR_TIMEOUT, QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED } from "@/lib/queue-errors";

type ListenRow = {
  trackId: number;
  trackTitle: string;
  trackArtists?: string | null;
  position: string;
  duration: string | null;
  bpm?: number | null;
  listened: boolean;
  saved: boolean;
  releaseId: number;
  releaseTitle: string;
  releaseCatno?: string | null;
  releaseArtist?: string | null;
  releaseDiscogsUrl: string;
  releaseThumbUrl: string | null;
  releaseWishlist: boolean;
  importSource?: string | null;
  labelId: number;
  labelName: string;
  labelActive?: boolean;
  hasChosenVideo?: boolean;
  youtubeVideoId?: string | null;
  videoEmbeddable?: boolean | null;
  playbackSource?: "discogs" | "youtube" | null;
  playedCount?: number;
  isUpNext?: boolean;
  wasPlayed?: boolean;
  needsMark?: boolean;
};

type LabelOption = {
  id: number;
  name: string;
  discogsUrl?: string;
};

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
  track?: { id: number; title: string; bpm?: number | null } | null;
  release?: {
    id?: number;
    title: string;
    artist?: string | null;
    catno?: string | null;
    discogsUrl?: string | null;
    thumbUrl?: string | null;
    wishlist?: boolean;
  } | null;
  label?: { name: string } | null;
};

const ENQUEUE_TIMEOUT_MS = 6000;
type PlaybackMode = "in_order" | "shuffle";
type QueueStateView = "all" | "needs_review" | "reviewed" | "played";

type ReleaseWishlistApiResponse = {
  ok?: boolean;
  wishlist?: boolean;
  error?: string;
  affectedReleaseIds?: number[];
  affectedTrackCount?: number;
  localConfirmedAll?: boolean;
  discogsSynced?: boolean;
};

async function updateTracks(payload: {
  trackIds: number[];
  field: "listened" | "saved";
  mode?: "set" | "toggle";
  value?: boolean;
}) {
  const response = await fetch("/api/tracks/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; tracks?: Array<{ trackId: number; listened: boolean; saved: boolean }> }
    | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "Unable to update track.");
  }

  for (const track of body.tracks ?? []) {
    if (payload.field === "saved") {
      window.dispatchEvent(
        new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
          detail: { trackId: track.trackId, field: "saved", value: track.saved },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
          detail: { trackId: track.trackId, field: "listened", value: track.listened },
        }),
      );
    }
  }

  return body.tracks ?? [];
}

async function addLabelFromRelease(releaseId: number) {
  const response = await fetch("/api/labels/from-release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId }),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "Unable to add label from release.");
  }
}

async function updateReleaseWishlist(payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean }) {
  const response = await fetch("/api/releases/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as ReleaseWishlistApiResponse | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "Unable to update record wishlist.");
  }
  return {
    wishlist: Boolean(body.wishlist),
    affectedReleaseIds: body.affectedReleaseIds ?? [payload.releaseId],
    affectedTrackCount: typeof body.affectedTrackCount === "number" ? body.affectedTrackCount : 0,
    localConfirmedAll: body.localConfirmedAll !== false,
    discogsSynced: body.discogsSynced !== false,
  };
}

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

function createOptimisticPlayItem(row: ListenRow): QueueApiItem | null {
  if (!row.youtubeVideoId) return null;
  return {
    id: -row.trackId,
    youtubeVideoId: row.youtubeVideoId,
    track: { id: row.trackId, title: row.trackTitle, bpm: row.bpm ?? null },
    release: {
      id: row.releaseId,
      title: row.releaseTitle,
      artist: row.releaseArtist ?? null,
      catno: row.releaseCatno ?? null,
      discogsUrl: row.releaseDiscogsUrl,
      thumbUrl: row.releaseThumbUrl ?? null,
      wishlist: row.releaseWishlist,
    },
    label: { name: row.labelName },
  };
}

export function ListenInboxClient({
  initialRows,
  initialSelectedLabelId,
  labelOptions,
  showQueueFilters = true,
  showWishlistSourceFilter = false,
  defaultHideReviewed = true,
  defaultHideAlreadyPlayed = true,
}: {
  initialRows: ListenRow[];
  initialSelectedLabelId?: number;
  labelOptions?: LabelOption[];
  showQueueFilters?: boolean;
  showWishlistSourceFilter?: boolean;
  defaultHideReviewed?: boolean;
  defaultHideAlreadyPlayed?: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(initialSelectedLabelId ?? null);
  const [labelFilterTouched, setLabelFilterTouched] = useState(initialSelectedLabelId != null);
  const [didAutoSelectPlayerLabel, setDidAutoSelectPlayerLabel] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [pendingFocusTrackId, setPendingFocusTrackId] = useState<number | null>(null);
  const lastScopeDispatchKeyRef = useRef<string>("");
  const scopeDispatchTimerRef = useRef<number | null>(null);
  const [wishlistSourceFilter, setWishlistSourceFilter] = useState<"all" | "saved_tracks" | "wishlisted_records">("all");
  const [hideReviewed, setHideReviewed] = useState(defaultHideReviewed);
  const [hideAlreadyPlayed, setHideAlreadyPlayed] = useState(defaultHideAlreadyPlayed);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [stateView, setStateView] = useState<QueueStateView>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "saved" | "wishlisted" | "saved_or_wishlisted">("all");
  const [videoFilter, setVideoFilter] = useState<"all" | "playable" | "no_video_or_private">("all");
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("in_order");
  const [addingLabelReleaseId, setAddingLabelReleaseId] = useState<number | null>(null);
  const [wishlistReleaseIdLoading, setWishlistReleaseIdLoading] = useState<number | null>(null);
  const [reviewingReleaseId, setReviewingReleaseId] = useState<number | null>(null);
  const [addedLabelReleaseIds, setAddedLabelReleaseIds] = useState<number[]>([]);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<number | null>(null);
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);
  const queueSyncInFlightRef = useRef(false);
  const lastQueueSyncAtRef = useRef(0);

  const requestRefresh = useCallback((delayMs = 180) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, delayMs);
  }, [router]);

  const sourceFilteredRows = useMemo(
    () =>
      rows.filter((item) => {
        if (!showWishlistSourceFilter || wishlistSourceFilter === "all") return true;
        if (wishlistSourceFilter === "saved_tracks") return item.saved;
        return item.releaseWishlist;
      }),
    [rows, showWishlistSourceFilter, wishlistSourceFilter],
  );
  const activeWishlistSourceMeta = useMemo(() => {
    if (wishlistSourceFilter === "saved_tracks") {
      return {
        label: "Saved Tracks only",
        description: "Only track-level saves.",
      };
    }
    if (wishlistSourceFilter === "wishlisted_records") {
      return {
        label: "Wishlisted Records only",
        description: "Only tracks from record-level Discogs wishlist items.",
      };
    }
    return {
      label: "All items",
      description: "Combines saved tracks and wishlisted-record tracks.",
    };
  }, [wishlistSourceFilter]);

  const rowDerivedLabelOptions = useMemo(() => {
    const pairs = new Map<number, string>();
    for (const row of sourceFilteredRows) {
      pairs.set(row.labelId, row.labelName);
    }
    return Array.from(pairs.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name, discogsUrl: undefined } satisfies LabelOption));
  }, [sourceFilteredRows]);
  const effectiveLabelOptions = useMemo(() => {
    // Library view should only list sources that actually have visible items.
    if (!showQueueFilters) return rowDerivedLabelOptions;
    if (!labelOptions || labelOptions.length === 0) return rowDerivedLabelOptions;
    const merged = new Map<number, LabelOption>();
    for (const item of rowDerivedLabelOptions) merged.set(item.id, item);
    for (const item of labelOptions) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [labelOptions, rowDerivedLabelOptions, showQueueFilters]);
  const activeLabelIds = useMemo(() => new Set((labelOptions ?? []).map((item) => item.id)), [labelOptions]);

  const selectedLabelStillExists = selectedLabelId !== null && effectiveLabelOptions.some((item) => item.id === selectedLabelId);
  const activeLabelId = selectedLabelStillExists ? selectedLabelId : null;
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
  const activeCursor = Math.max(0, Math.min(cursor, Math.max(0, visibleRows.length - 1)));
  const current = visibleRows[activeCursor] ?? null;
  const currentHasPlayableVideo =
    Boolean(current?.youtubeVideoId) &&
    (current?.playbackSource === "discogs" || current?.videoEmbeddable !== false);
  const currentCanPlay = !youtubeQuotaExceeded;
  const currentPlayHint = !currentHasPlayableVideo
    ? "No linked playable video yet. Play Now will search and queue one."
    : null;
  const showMobileQuickRail = showQueueFilters && Boolean(current);
  const filterButtonClass = (active: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60 sm:px-3 sm:text-sm ${
      active
        ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface2)_80%)] text-[var(--color-text)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
        : "border-[var(--color-border)] bg-[var(--color-surface)]/45 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
    }`;
  const setGlobalPlaybackMode = useCallback((nextMode: PlaybackMode) => {
    setPlaybackMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, nextMode);
      window.dispatchEvent(new CustomEvent(PLAYBACK_MODE_EVENT, { detail: { mode: nextMode } }));
    }
  }, []);
  const selectedSet = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);
  const labelIdByTrackId = useMemo(() => {
    const mapped = new Map<number, number>();
    for (const row of rows) mapped.set(row.trackId, row.labelId);
    return mapped;
  }, [rows]);
  const selectedVisibleRows = useMemo(
    () => visibleRows.filter((row) => selectedSet.has(row.trackId)),
    [selectedSet, visibleRows],
  );
  const visibleNeedsReviewRows = useMemo(
    () => visibleRows.filter((row) => !row.listened && ((row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed))),
    [visibleRows],
  );
  const scopedTrackIds = useMemo(() => scopedRows.map((row) => row.trackId), [scopedRows]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPlaybackMode = window.localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY);
    if (storedPlaybackMode === "shuffle" || storedPlaybackMode === "in_order") {
      setPlaybackMode(storedPlaybackMode);
    }
    setYoutubeQuotaExceeded(isYouTubeQuotaExceededInSession());
  }, []);

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

  const syncUpNextFromQueue = useCallback(async () => {
    const now = Date.now();
    if (queueSyncInFlightRef.current) return;
    if (now - lastQueueSyncAtRef.current < 1200) return;
    queueSyncInFlightRef.current = true;
    lastQueueSyncAtRef.current = now;
    try {
      const response = await fetch("/api/queue/list?limit=40");
      if (!response.ok) return;
      const body = (await response.json().catch(() => null)) as { items?: QueueApiItem[] } | null;
      const queuedTrackIds = new Set(
        (body?.items ?? [])
          .map((item) => item.track?.id)
          .filter((id): id is number => typeof id === "number"),
      );
      setRows((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          const isUpNext = queuedTrackIds.has(row.trackId);
          if (row.isUpNext === isUpNext) return row;
          changed = true;
          return { ...row, isUpNext };
        });
        return changed ? next : prev;
      });
    } catch {
      // Non-blocking: keep current UI state if queue endpoint is temporarily unavailable.
    } finally {
      queueSyncInFlightRef.current = false;
    }
  }, []);

  const playRow = useCallback(async (trackId: number) => {
    if (youtubeQuotaExceeded) return;
    setLoadingTrackId(trackId);
    const row = rows.find((item) => item.trackId === trackId);
    const optimisticItem = row ? createOptimisticPlayItem(row) : null;
    try {
      if (optimisticItem) {
        window.dispatchEvent(new CustomEvent(PLAY_ITEM_EVENT, { detail: optimisticItem }));
      }

      const item = await enqueueTrackForClient<QueueApiItem>({
        trackId,
        queueMode: "next",
        timeoutMs: ENQUEUE_TIMEOUT_MS,
        retryTimeoutCount: 1,
      });
      if (!optimisticItem || optimisticItem.youtubeVideoId !== item.youtubeVideoId) {
        window.dispatchEvent(new CustomEvent(PLAY_ITEM_EVENT, { detail: item }));
      }
      setPlayingTrackId(trackId);
      setPlayerIsPlaying(true);
      setRows((prev) =>
        prev.map((row) =>
          row.trackId === trackId
            ? { ...row, isUpNext: false }
            : row,
        ),
      );
      setFeedback(optimisticItem ? "Loading in mini-player…" : "Playing.");
      void syncUpNextFromQueue();
    } catch (error) {
      if (error instanceof Error && error.message === QUEUE_ERROR_NO_MATCH) {
        setFeedback("No playable video found yet for this track. Try again in a few seconds.");
        return;
      }
      if (error instanceof Error && error.message === QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED) {
        setYoutubeQuotaExceeded(true);
        setFeedback("YouTube quota reached. Queue/play is temporarily disabled. You can still mark tracks listened.");
        setYouTubeQuotaExceededInSession();
        return;
      }
      if (error instanceof Error && error.message === QUEUE_ERROR_TIMEOUT) {
        setFeedback("Play request timed out. Retrying often fixes this.");
        return;
      }
      const message = error instanceof Error ? error.message : "Unable to queue track.";
      setFeedback(message);
    } finally {
      setLoadingTrackId((current) => (current === trackId ? null : current));
    }
  }, [rows, syncUpNextFromQueue, youtubeQuotaExceeded]);

  const clearYoutubeQuotaExceeded = useCallback(() => {
    setYoutubeQuotaExceeded(false);
    setFeedback(null);
    clearYouTubeQuotaExceededInSession();
  }, []);

  const markCurrentListened = useCallback(async () => {
    if (!current) return;
    const wasPlaying = current.trackId === playingTrackId;
    const nextTrackId = visibleRows[activeCursor + 1]?.trackId ?? visibleRows[activeCursor - 1]?.trackId ?? null;
    await updateTracks({ trackIds: [current.trackId], field: "listened", mode: "set", value: true });
    setRows((prev) => {
      const next = prev.map((item) =>
        item.trackId === current.trackId
          ? { ...item, listened: true, isUpNext: false }
          : item,
      );
      setCursor((cursorPrev) => Math.max(0, Math.min(cursorPrev, Math.max(0, next.length - 1))));
      return next;
    });
    setPendingFocusTrackId(nextTrackId);
    if (wasPlaying && nextTrackId) {
      void playRow(nextTrackId);
    } else if (wasPlaying) {
      window.dispatchEvent(new CustomEvent(PLAYBACK_NEXT_EVENT));
    }
    requestRefresh();
  }, [activeCursor, current, playRow, playingTrackId, requestRefresh, visibleRows]);

  const toggleCurrentSaved = useCallback(async () => {
    if (!current) return;
    const updated = await updateTracks({ trackIds: [current.trackId], field: "saved", mode: "toggle" });
    const nextSaved = updated.find((item) => item.trackId === current.trackId)?.saved ?? current.saved;
    setRows((prev) => {
      const next = prev.map((item) =>
        item.trackId === current.trackId
          ? { ...item, saved: nextSaved, isUpNext: false }
          : item,
      );
      return showQueueFilters ? next : next.filter((item) => item.saved);
    });
    requestRefresh();
  }, [current, requestRefresh, showQueueFilters]);

  const markRowListened = useCallback(async (trackId: number) => {
    const wasPlaying = trackId === playingTrackId;
    const rowIndex = visibleRows.findIndex((item) => item.trackId === trackId);
    const nextTrackId = rowIndex >= 0
      ? (visibleRows[rowIndex + 1]?.trackId ?? visibleRows[rowIndex - 1]?.trackId ?? null)
      : null;
    await updateTracks({ trackIds: [trackId], field: "listened", mode: "set", value: true });
    setRows((prev) => {
      const next = prev.map((row) =>
        row.trackId === trackId
          ? { ...row, listened: true, isUpNext: false }
          : row,
      );
      setCursor((cursorPrev) => Math.max(0, Math.min(cursorPrev, Math.max(0, next.length - 1))));
      return next;
    });
    setPendingFocusTrackId(nextTrackId);
    if (wasPlaying && nextTrackId) {
      void playRow(nextTrackId);
    } else if (wasPlaying) {
      window.dispatchEvent(new CustomEvent(PLAYBACK_NEXT_EVENT));
    }
    requestRefresh();
  }, [playRow, playingTrackId, requestRefresh, visibleRows]);

  const markRowReleaseListened = useCallback(async (releaseId: number, trackId: number, releaseDiscogsUrl: string) => {
    if (reviewingReleaseId === releaseId) return;
    const normalizedReleaseUrl = releaseDiscogsUrl.trim().toLowerCase();
    const releaseGroupRows = visibleRows.filter((row) => row.releaseDiscogsUrl.trim().toLowerCase() === normalizedReleaseUrl);
    const targetTrackIds = [...new Set((releaseGroupRows.length > 0 ? releaseGroupRows : [{ trackId }]).map((row) => row.trackId))];
    const targetTrackIdSet = new Set(targetTrackIds);
    const wasPlayingRelease = playingTrackId !== null && targetTrackIdSet.has(playingTrackId);
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
    setReviewingReleaseId(releaseId);
    try {
      await updateTracks({ trackIds: targetTrackIds, field: "listened", mode: "set", value: true });
      setRows((prev) => {
        const next = prev.map((row) => (targetTrackIdSet.has(row.trackId) ? { ...row, listened: true, isUpNext: false } : row));
        return showQueueFilters ? next : next.filter((row) => row.saved);
      });
      setPendingFocusTrackId(nextTrackId);
      if (!nextTrackId) {
        setFeedback("Release marked reviewed. End of queue reached.");
      }
      if (wasPlayingRelease && nextTrackId) {
        void playRow(nextTrackId);
      } else if (wasPlayingRelease) {
        window.dispatchEvent(new CustomEvent(PLAYBACK_NEXT_EVENT));
      }
      requestRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to mark release reviewed.");
    } finally {
      setReviewingReleaseId(null);
    }
  }, [playRow, playingTrackId, requestRefresh, reviewingReleaseId, showQueueFilters, visibleRows]);

  const toggleRowSaved = useCallback(async (trackId: number) => {
    const updated = await updateTracks({ trackIds: [trackId], field: "saved", mode: "toggle" });
    const updatedTrack = updated.find((item) => item.trackId === trackId);
    if (!updatedTrack) return;
    setRows((prev) => {
      const next = prev.map((row) =>
        row.trackId === trackId
          ? { ...row, saved: updatedTrack.saved, isUpNext: false }
          : row,
      );
      return showQueueFilters ? next : next.filter((row) => row.saved);
    });
    requestRefresh();
  }, [requestRefresh, showQueueFilters]);

  const toggleRowRecordWishlist = useCallback(async (releaseId: number) => {
    if (wishlistReleaseIdLoading === releaseId) return;
    const currentValue = rows.find((row) => row.releaseId === releaseId)?.releaseWishlist ?? false;
    const nextWishlist = !currentValue;
    setWishlistReleaseIdLoading(releaseId);
    setRows((prev) => prev.map((row) => (row.releaseId === releaseId ? { ...row, releaseWishlist: nextWishlist } : row)));
    try {
      const result = await updateReleaseWishlist({ releaseId, mode: "set", value: nextWishlist });
      const affectedIds = new Set(result.affectedReleaseIds);
      setRows((prev) =>
        prev.map((row) => (affectedIds.has(row.releaseId) ? { ...row, releaseWishlist: result.wishlist } : row)),
      );
      window.dispatchEvent(
        new CustomEvent(RELEASE_WISHLIST_UPDATED_EVENT, {
          detail: { releaseId, releaseIds: [...affectedIds], value: result.wishlist },
        }),
      );
      const scopeSuffix = result.affectedTrackCount > 0 ? ` (${result.affectedTrackCount} tracks)` : "";
      const syncSuffix = result.discogsSynced ? "" : " Discogs sync is delayed; local state is saved.";
      const verifySuffix = result.localConfirmedAll ? "" : " Local confirmation is still syncing.";
      setFeedback(
        `${result.wishlist ? "Added record to Discogs wishlist" : "Removed record from Discogs wishlist"}${scopeSuffix}.${syncSuffix}${verifySuffix}`,
      );
      requestRefresh();
    } catch (error) {
      setRows((prev) => prev.map((row) => (row.releaseId === releaseId ? { ...row, releaseWishlist: currentValue } : row)));
      setFeedback(error instanceof Error ? error.message : "Unable to update record wishlist.");
    } finally {
      setWishlistReleaseIdLoading(null);
    }
  }, [requestRefresh, rows, wishlistReleaseIdLoading]);

  const addRowLabel = useCallback(async (releaseId: number) => {
    if (addingLabelReleaseId === releaseId) return;
    if (addedLabelReleaseIds.includes(releaseId)) return;
    setAddingLabelReleaseId(releaseId);
    setFeedback("Adding and activating label...");
    try {
      await addLabelFromRelease(releaseId);
      setRows((prev) => prev.map((row) => (row.releaseId === releaseId ? { ...row, labelActive: true } : row)));
      setAddedLabelReleaseIds((prev) => (prev.includes(releaseId) ? prev : [...prev, releaseId]));
      setFeedback("Label added and activated.");
      requestRefresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to add label.");
    } finally {
      setAddingLabelReleaseId(null);
    }
  }, [addedLabelReleaseIds, addingLabelReleaseId, requestRefresh]);

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

  const bulkSetSelectedListened = useCallback(async () => {
    const eligible = selectedVisibleRows.filter((row) => row.importSource !== "discogs_want").map((row) => row.trackId);
    if (eligible.length === 0) return;
    await updateTracks({ trackIds: eligible, field: "listened", mode: "set", value: true });
    setRows((prev) => prev.map((row) => (eligible.includes(row.trackId) ? { ...row, listened: true, isUpNext: false } : row)));
    setSelectedTrackIds((prev) => prev.filter((id) => !eligible.includes(id)));
    setFeedback(`Marked ${eligible.length} tracks reviewed.`);
    requestRefresh();
  }, [requestRefresh, selectedVisibleRows]);

  const bulkSetSelectedSaved = useCallback(async (value: boolean) => {
    const ids = selectedVisibleRows.map((row) => row.trackId);
    if (ids.length === 0) return;
    await updateTracks({ trackIds: ids, field: "saved", mode: "set", value });
    setRows((prev) => {
      const next = prev.map((row) =>
        ids.includes(row.trackId)
          ? { ...row, saved: value, isUpNext: value ? false : row.isUpNext }
          : row,
      );
      return showQueueFilters ? next : next.filter((row) => row.saved);
    });
    setSelectedTrackIds((prev) => prev.filter((id) => !ids.includes(id)));
    setFeedback(value ? `Saved ${ids.length} tracks.` : `Removed ${ids.length} saved tracks.`);
    requestRefresh();
  }, [requestRefresh, selectedVisibleRows, showQueueFilters]);

  const bulkMarkVisiblePlayedReviewed = useCallback(async () => {
    const ids = visibleNeedsReviewRows.map((row) => row.trackId);
    if (ids.length === 0) return;
    await updateTracks({ trackIds: ids, field: "listened", mode: "set", value: true });
    setRows((prev) => prev.map((row) => (ids.includes(row.trackId) ? { ...row, listened: true, isUpNext: false } : row)));
    setSelectedTrackIds((prev) => prev.filter((id) => !ids.includes(id)));
    setFeedback(`Marked ${ids.length} played tracks reviewed.`);
    requestRefresh();
  }, [requestRefresh, visibleNeedsReviewRows]);

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

  useEffect(() => {
    if (pendingFocusTrackId === null) return;
    const nextIndex = visibleRows.findIndex((row) => row.trackId === pendingFocusTrackId);
    if (nextIndex >= 0) {
      setCursor(nextIndex);
    } else {
      setCursor((prev) => Math.max(0, Math.min(prev, Math.max(0, visibleRows.length - 1))));
    }
    setPendingFocusTrackId(null);
  }, [pendingFocusTrackId, visibleRows]);

  useEffect(() => {
    const onQuotaExceeded = () => {
      setYoutubeQuotaExceeded(true);
      setFeedback((prev) => prev || "YouTube quota reached. Queue/play is temporarily disabled. You can still mark tracks listened.");
    };

    window.addEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
    return () => window.removeEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
  }, []);

  useEffect(() => {
    const onQuotaCleared = () => {
      setYoutubeQuotaExceeded(false);
      setFeedback(null);
    };

    window.addEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
    return () => window.removeEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
  }, []);

  useEffect(() => {
    const onPlayerCurrent = (event: Event) => {
      const custom = event as CustomEvent<{
        trackId: number | null;
        saved?: boolean | null;
        listened?: boolean | null;
        playing?: boolean | null;
      }>;
      const nextTrackId = custom.detail?.trackId ?? null;
      const nextSaved = custom.detail?.saved;
      const nextListened = custom.detail?.listened;
      const nextPlaying = custom.detail?.playing;
      setPlayingTrackId(nextTrackId);
      if (typeof nextPlaying === "boolean") setPlayerIsPlaying(nextPlaying);
      if (nextTrackId) {
        setRows((prev) =>
          prev.map((row) =>
            row.trackId === nextTrackId
              ? {
                  ...row,
                  isUpNext: false,
                  saved: typeof nextSaved === "boolean" ? nextSaved : row.saved,
                  listened: typeof nextListened === "boolean" ? nextListened : row.listened,
                }
              : row,
          ),
        );
      }
      if (showQueueFilters && !labelFilterTouched && !didAutoSelectPlayerLabel && selectedLabelId === null && nextTrackId) {
        const playerLabelId = labelIdByTrackId.get(nextTrackId);
        if (playerLabelId) {
          setSelectedLabelId(playerLabelId);
          setDidAutoSelectPlayerLabel(true);
        }
      }
      void syncUpNextFromQueue();
    };

    window.addEventListener(PLAYER_CURRENT_EVENT, onPlayerCurrent as EventListener);
    return () => window.removeEventListener(PLAYER_CURRENT_EVENT, onPlayerCurrent as EventListener);
  }, [didAutoSelectPlayerLabel, labelFilterTouched, labelIdByTrackId, selectedLabelId, showQueueFilters, syncUpNextFromQueue]);

  useEffect(() => {
    const onTrackTodoUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ trackId?: number; field?: "saved" | "listened"; value?: boolean }>;
      const trackId = custom.detail?.trackId;
      const field = custom.detail?.field;
      const value = custom.detail?.value;
      if (typeof trackId !== "number" || (field !== "saved" && field !== "listened") || typeof value !== "boolean") return;

      setRows((prev) => {
        const next = prev.map((row) =>
          row.trackId === trackId
            ? field === "saved"
              ? { ...row, saved: value }
              : { ...row, listened: value }
            : row,
        );
        return showQueueFilters ? next : next.filter((row) => row.saved);
      });
    };

    window.addEventListener(TRACK_TODO_UPDATED_EVENT, onTrackTodoUpdated as EventListener);
    return () => window.removeEventListener(TRACK_TODO_UPDATED_EVENT, onTrackTodoUpdated as EventListener);
  }, [showQueueFilters]);

  useEffect(() => {
    const onReleaseWishlistUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ releaseId?: number; releaseIds?: number[]; value?: boolean }>;
      const releaseId = custom.detail?.releaseId;
      const releaseIds = custom.detail?.releaseIds ?? [];
      const value = custom.detail?.value;
      if (typeof value !== "boolean") return;
      const affected = new Set<number>(releaseIds.filter((id) => Number.isFinite(id)));
      if (typeof releaseId === "number") affected.add(releaseId);
      if (affected.size === 0) return;
      setRows((prev) => prev.map((row) => (affected.has(row.releaseId) ? { ...row, releaseWishlist: value } : row)));
    };

    window.addEventListener(RELEASE_WISHLIST_UPDATED_EVENT, onReleaseWishlistUpdated as EventListener);
    return () => window.removeEventListener(RELEASE_WISHLIST_UPDATED_EVENT, onReleaseWishlistUpdated as EventListener);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void syncUpNextFromQueue(), 0);
    const interval = window.setInterval(() => void syncUpNextFromQueue(), 15000);
    window.dispatchEvent(new CustomEvent(REQUEST_PLAYER_CURRENT_EVENT));
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [syncUpNextFromQueue]);

  useEffect(() => {
    const trackIds = scopedTrackIds.slice(0, 1200);
    const scopeKey = `${showQueueFilters ? "1" : "0"}|${activeLabelId ?? "none"}|${trackIds.join(",")}`;
    if (scopeKey === lastScopeDispatchKeyRef.current) return;
    lastScopeDispatchKeyRef.current = scopeKey;
    if (scopeDispatchTimerRef.current !== null) {
      window.clearTimeout(scopeDispatchTimerRef.current);
    }
    scopeDispatchTimerRef.current = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(LISTENING_SCOPE_EVENT, {
          detail: {
            enabled: showQueueFilters,
            trackIds,
            activeLabelId,
          },
        }),
      );
      scopeDispatchTimerRef.current = null;
    }, 120);
    return () => {
      if (scopeDispatchTimerRef.current !== null) {
        window.clearTimeout(scopeDispatchTimerRef.current);
        scopeDispatchTimerRef.current = null;
      }
    };
  }, [activeLabelId, scopedTrackIds, showQueueFilters]);

  useEffect(() => {
    const onPlaybackMode = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: PlaybackMode }>;
      const nextMode = custom.detail?.mode;
      if (nextMode === "shuffle" || nextMode === "in_order") {
        setPlaybackMode(nextMode);
      }
    };
    window.addEventListener(PLAYBACK_MODE_EVENT, onPlaybackMode as EventListener);
    return () => window.removeEventListener(PLAYBACK_MODE_EVENT, onPlaybackMode as EventListener);
  }, []);

  return (
    <div className="space-y-3 pb-36 sm:pb-0">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-2.5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--color-accent)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-surface)_70%,var(--color-surface2)_30%)] p-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => moveLabel(-1)}
              disabled={effectiveLabelOptions.length === 0}
              title="Select previous label"
              className="h-10 shrink-0 border-[color-mix(in_oklab,var(--color-accent)_38%,var(--color-border-soft))] bg-[var(--color-surface)] px-4 text-sm font-semibold"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev label
            </Button>
            <select
              value={activeLabelId === null ? "" : String(activeLabelId)}
              onChange={(event) => {
                setLabelFilterTouched(true);
                setSelectedLabelId(event.target.value ? Number(event.target.value) : null);
                setCursor(0);
              }}
              className="h-10 min-w-[220px] flex-1 rounded-md border border-[color-mix(in_oklab,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 text-base font-medium"
              title="Filter tracks by label"
              aria-label="Filter tracks by label"
            >
              <option value="">All sources</option>
              {effectiveLabelOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => moveLabel(1)}
              disabled={effectiveLabelOptions.length === 0}
              title="Select next label"
              className="h-10 shrink-0 border-[color-mix(in_oklab,var(--color-accent)_38%,var(--color-border-soft))] bg-[var(--color-surface)] px-4 text-sm font-semibold"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Next label
            </Button>
            {activeLabel?.discogsUrl ? (
              <a
                href={toDiscogsWebUrl(activeLabel.discogsUrl, "")}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                title="Open selected label on Discogs"
                aria-label="Open selected label on Discogs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {activeLabelIndex >= 0 ? (
              <span className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--color-text)]">
                {activeLabelIndex + 1}/{effectiveLabelOptions.length}
              </span>
            ) : null}
          </div>

          {showWishlistSourceFilter ? (
            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Source</span>
                <button
                  type="button"
                  onClick={() => {
                    setWishlistSourceFilter("all");
                    setCursor(0);
                  }}
                  className={filterButtonClass(wishlistSourceFilter === "all")}
                  aria-pressed={wishlistSourceFilter === "all"}
                  title="Show all library items (saved tracks + wishlisted records)"
                  aria-label="Show all library items"
                >
                  <CheckSquare className="mr-1 inline h-3 w-3" />
                  All ({wishlistSourceCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWishlistSourceFilter("saved_tracks");
                    setCursor(0);
                  }}
                  className={filterButtonClass(wishlistSourceFilter === "saved_tracks")}
                  aria-pressed={wishlistSourceFilter === "saved_tracks"}
                  title="Show only tracks saved locally"
                  aria-label="Show saved tracks only"
                >
                  <Disc3 className="mr-1 inline h-3 w-3" />
                  Saved Tracks ({wishlistSourceCounts.savedTracks})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWishlistSourceFilter("wishlisted_records");
                    setCursor(0);
                  }}
                  className={filterButtonClass(wishlistSourceFilter === "wishlisted_records")}
                  aria-pressed={wishlistSourceFilter === "wishlisted_records"}
                  title="Show tracks that belong to records in your Discogs wishlist"
                  aria-label="Show wishlisted records only"
                >
                  <BookmarkCheck className="mr-1 inline h-3 w-3" />
                  Wishlisted Records ({wishlistSourceCounts.wishlistedRecords})
                </button>
            </div>
          ) : null}

          {showQueueFilters ? (
            <>
              <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2 sm:hidden">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Filters & Bulk
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={commuteModeActive ? "secondary" : "outline"}
                      className="h-9 w-full justify-center"
                      onClick={applyCommuteMode}
                      title="Train-friendly preset: Needs Review + Playable + hide reviewed/played"
                    >
                      Commute Mode
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 w-full justify-center"
                      onClick={resetCommuteMode}
                      disabled={!commuteModeActive}
                      title="Reset commute preset filters"
                    >
                      Reset Preset
                    </Button>
                  </div>
                  <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button type="button" onClick={() => { setStateView("all"); setCursor(0); }} className={filterButtonClass(stateView === "all")} aria-pressed={stateView === "all"}>All ({queueFilterCounts.all})</button>
                    <button type="button" onClick={() => { setStateView("needs_review"); setCursor(0); }} className={filterButtonClass(stateView === "needs_review")} aria-pressed={stateView === "needs_review"}>Needs Review ({queueFilterCounts.needsReview})</button>
                    <button type="button" onClick={() => { setStateView("reviewed"); setCursor(0); }} className={filterButtonClass(stateView === "reviewed")} aria-pressed={stateView === "reviewed"}>Reviewed ({queueFilterCounts.reviewed})</button>
                    <button type="button" onClick={() => { setStateView("played"); setCursor(0); }} className={filterButtonClass(stateView === "played")} aria-pressed={stateView === "played"}>Played ({queueFilterCounts.played})</button>
                  </div>
                  <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => { setHideReviewed((prev) => !prev); setCursor(0); }}
                      className={filterButtonClass(hideReviewed)}
                      aria-pressed={hideReviewed}
                    >
                      Exclude reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHideAlreadyPlayed((prev) => !prev); setCursor(0); }}
                      className={filterButtonClass(hideAlreadyPlayed)}
                      aria-pressed={hideAlreadyPlayed}
                    >
                      Exclude played
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
                      className={filterButtonClass(advancedFiltersOpen)}
                      aria-expanded={advancedFiltersOpen}
                    >
                      {advancedFiltersOpen ? "Hide" : "More"} filters
                      {hasAdvancedFiltersActive ? " (active)" : ""}
                    </button>
                  </div>
                  {advancedFiltersOpen ? (
                    <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2">
                      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Source</span>
                        <button type="button" onClick={() => setSourceFilter("all")} className={filterButtonClass(sourceFilter === "all")} aria-pressed={sourceFilter === "all"}>All ({sourceFilterCounts.all})</button>
                        <button type="button" onClick={() => setSourceFilter("saved")} className={filterButtonClass(sourceFilter === "saved")} aria-pressed={sourceFilter === "saved"}>Saved ({sourceFilterCounts.saved})</button>
                        <button type="button" onClick={() => setSourceFilter("wishlisted")} className={filterButtonClass(sourceFilter === "wishlisted")} aria-pressed={sourceFilter === "wishlisted"}>Wishlisted ({sourceFilterCounts.wishlisted})</button>
                      </div>
                      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Video</span>
                        <button type="button" onClick={() => setVideoFilter("all")} className={filterButtonClass(videoFilter === "all")} aria-pressed={videoFilter === "all"}>Any ({videoFilterCounts.all})</button>
                        <button type="button" onClick={() => setVideoFilter("playable")} className={filterButtonClass(videoFilter === "playable")} aria-pressed={videoFilter === "playable"}>Playable ({videoFilterCounts.playable})</button>
                        <button type="button" onClick={() => setVideoFilter("no_video_or_private")} className={filterButtonClass(videoFilter === "no_video_or_private")} aria-pressed={videoFilter === "no_video_or_private"}>No video/private ({videoFilterCounts.noVideoOrPrivate})</button>
                      </div>
                      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Playback</span>
                        <button type="button" onClick={() => setGlobalPlaybackMode("in_order")} className={filterButtonClass(playbackMode === "in_order")} aria-pressed={playbackMode === "in_order"}><ListOrdered className="mr-1 inline h-3 w-3" />In Order</button>
                        <button type="button" onClick={() => setGlobalPlaybackMode("shuffle")} className={filterButtonClass(playbackMode === "shuffle")} aria-pressed={playbackMode === "shuffle"}><Shuffle className="mr-1 inline h-3 w-3" />Shuffle</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={selectVisibleTracks} disabled={visibleRows.length === 0}>
                      <CheckSquare className="h-3.5 w-3.5" />
                      Select all
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={clearSelectedTracks} disabled={selectedTrackIds.length === 0}>
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  </div>
                  {showQueueFilters && visibleNeedsReviewRows.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center"
                      onClick={() => void bulkMarkVisiblePlayedReviewed()}
                      disabled={visibleNeedsReviewRows.length === 0}
                      title="Mark all played tracks in this view as reviewed"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all played reviewed ({visibleNeedsReviewRows.length})
                    </Button>
                  ) : null}
                </div>
              </details>

              <div className="hidden flex-wrap items-center gap-2 text-xs sm:flex">
              <div className="inline-flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">View</span>
                <button
                  type="button"
                  onClick={() => {
                    setStateView("all");
                    setCursor(0);
                  }}
                  className={filterButtonClass(stateView === "all")}
                  aria-pressed={stateView === "all"}
                  title="Show all tracks in the current scope"
                  aria-label="View all tracks"
                >
                  All ({queueFilterCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStateView("needs_review");
                    setCursor(0);
                  }}
                  className={filterButtonClass(stateView === "needs_review")}
                  aria-pressed={stateView === "needs_review"}
                  title="Show only played tracks still waiting for review"
                  aria-label="View tracks that need review"
                >
                  Needs Review ({queueFilterCounts.needsReview})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStateView("reviewed");
                    setCursor(0);
                  }}
                  className={filterButtonClass(stateView === "reviewed")}
                  aria-pressed={stateView === "reviewed"}
                  title="Show only tracks already marked reviewed"
                  aria-label="View reviewed tracks"
                >
                  Reviewed ({queueFilterCounts.reviewed})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStateView("played");
                    setCursor(0);
                  }}
                  className={filterButtonClass(stateView === "played")}
                  aria-pressed={stateView === "played"}
                  title="Show only tracks with playback history"
                  aria-label="View played tracks"
                >
                  Played ({queueFilterCounts.played})
                </button>
              </div>
              <div className="inline-flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Exclude</span>
                <button
                  type="button"
                  onClick={() => {
                    setHideReviewed((prev) => !prev);
                    setCursor(0);
                  }}
                  className={filterButtonClass(hideReviewed)}
                  aria-pressed={hideReviewed}
                  title="Hide reviewed tracks from the current view"
                  aria-label="Exclude reviewed tracks"
                >
                  Reviewed ({queueFilterCounts.reviewed})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHideAlreadyPlayed((prev) => !prev);
                    setCursor(0);
                  }}
                  className={filterButtonClass(hideAlreadyPlayed)}
                  aria-pressed={hideAlreadyPlayed}
                  title="Hide played tracks from the current view"
                  aria-label="Exclude played tracks"
                >
                  Played ({queueFilterCounts.played})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                aria-expanded={advancedFiltersOpen}
                title="Show source, video, and playback filters"
              >
                {advancedFiltersOpen ? "Hide" : "More"} filters
                {hasAdvancedFiltersActive ? " (active)" : ""}
              </button>
              {advancedFiltersOpen ? (
                <div className="w-full space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2">
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Source</span>
                    <button type="button" onClick={() => setSourceFilter("all")} className={filterButtonClass(sourceFilter === "all")} aria-pressed={sourceFilter === "all"}>All ({sourceFilterCounts.all})</button>
                    <button type="button" onClick={() => setSourceFilter("saved")} className={filterButtonClass(sourceFilter === "saved")} aria-pressed={sourceFilter === "saved"}>Saved ({sourceFilterCounts.saved})</button>
                    <button type="button" onClick={() => setSourceFilter("wishlisted")} className={filterButtonClass(sourceFilter === "wishlisted")} aria-pressed={sourceFilter === "wishlisted"}>Wishlisted ({sourceFilterCounts.wishlisted})</button>
                    <button type="button" onClick={() => setSourceFilter("saved_or_wishlisted")} className={filterButtonClass(sourceFilter === "saved_or_wishlisted")} aria-pressed={sourceFilter === "saved_or_wishlisted"}>Saved or Wishlisted ({sourceFilterCounts.savedOrWishlisted})</button>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Video</span>
                    <button type="button" onClick={() => setVideoFilter("all")} className={filterButtonClass(videoFilter === "all")} aria-pressed={videoFilter === "all"}>Any ({videoFilterCounts.all})</button>
                    <button type="button" onClick={() => setVideoFilter("playable")} className={filterButtonClass(videoFilter === "playable")} aria-pressed={videoFilter === "playable"}>Playable ({videoFilterCounts.playable})</button>
                    <button type="button" onClick={() => setVideoFilter("no_video_or_private")} className={filterButtonClass(videoFilter === "no_video_or_private")} aria-pressed={videoFilter === "no_video_or_private"}>No video/private ({videoFilterCounts.noVideoOrPrivate})</button>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Playback</span>
                    <button type="button" onClick={() => setGlobalPlaybackMode("in_order")} className={filterButtonClass(playbackMode === "in_order")} aria-pressed={playbackMode === "in_order"}><ListOrdered className="mr-1 inline h-3 w-3" />In Order</button>
                    <button type="button" onClick={() => setGlobalPlaybackMode("shuffle")} className={filterButtonClass(playbackMode === "shuffle")} aria-pressed={playbackMode === "shuffle"}><Shuffle className="mr-1 inline h-3 w-3" />Shuffle</button>
                  </div>
                </div>
              ) : null}
              </div>
            </>
          ) : null}
        </div>
        {!showQueueFilters ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            This view includes both saved tracks and wishlisted-record tracks. Use filters to split them.
          </p>
        ) : null}
        {showWishlistSourceFilter ? (
          <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
            <p className="text-xs font-medium">{activeWishlistSourceMeta.label} active</p>
            <p className="text-xs text-[var(--color-muted)]">{activeWishlistSourceMeta.description}</p>
          </div>
        ) : null}
        <div className="mt-1.5 hidden text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-center sm:w-auto sm:justify-start"
            onClick={selectVisibleTracks}
            disabled={visibleRows.length === 0}
            title="Select every track currently visible"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-center sm:w-auto sm:justify-start"
            onClick={clearSelectedTracks}
            disabled={selectedTrackIds.length === 0}
            title="Clear all selected tracks"
          >
            <X className="h-3.5 w-3.5" />
            Clear selection
          </Button>
          <span className="col-span-2 text-[var(--color-muted)] sm:col-auto">{selectedVisibleRows.length} selected</span>
          {showQueueFilters && selectedVisibleRows.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
              onClick={() => void bulkSetSelectedListened()}
              disabled={selectedVisibleRows.length === 0}
              title="Mark selected tracks as reviewed"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark selected reviewed
            </Button>
          ) : null}
          {showQueueFilters && visibleNeedsReviewRows.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-center sm:w-auto sm:justify-start"
              onClick={() => void bulkMarkVisiblePlayedReviewed()}
              disabled={visibleNeedsReviewRows.length === 0}
              title="Mark all played tracks in this view as reviewed"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all played reviewed ({visibleNeedsReviewRows.length})
            </Button>
          ) : null}
          {selectedVisibleRows.length > 0 ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full justify-center sm:w-auto sm:justify-start"
                onClick={() => void bulkSetSelectedSaved(true)}
                disabled={selectedVisibleRows.length === 0}
                title="Track save is local only and does not add to your Discogs wantlist."
                aria-label="Save selected tracks. Does not add to your Discogs wantlist."
              >
                <Heart className="h-3.5 w-3.5" />
                Save selected
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-center sm:w-auto sm:justify-start"
                onClick={() => void bulkSetSelectedSaved(false)}
                disabled={selectedVisibleRows.length === 0}
                title="Remove selected tracks from local saved list"
              >
                <HeartOff className="h-3.5 w-3.5" />
                Unsave selected
              </Button>
            </>
          ) : null}
        </div>
      </div>

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
        <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] p-2 shadow-xl sm:hidden">
          <p className="line-clamp-1 text-[11px] font-medium text-[var(--color-text)]">
            {current.position} {current.trackTitle}
          </p>
          <p className="line-clamp-1 text-[10px] text-[var(--color-muted)]">
            {current.labelName} • {current.releaseTitle}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-10 w-full justify-center"
              onClick={() => void playRow(current.trackId)}
              disabled={!currentCanPlay || loadingTrackId === current.trackId}
              title={currentPlayHint || "Play now in the mini-player"}
              aria-label="Play current track now"
            >
              {loadingTrackId === current.trackId ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {loadingTrackId === current.trackId ? "Loading..." : "Play"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-10 w-full justify-center rounded-md border border-emerald-400/60 bg-emerald-500/28 text-emerald-50 hover:bg-emerald-500/38"
              onClick={() => void markCurrentListened()}
              title="Mark current track reviewed and move forward"
              aria-label="Mark current track reviewed"
            >
              <CheckCircle2 className="h-4 w-4" />
              Reviewed
            </Button>
            <Button
              type="button"
              size="sm"
              variant={current.saved ? "secondary" : "ghost"}
              className="h-10 w-full justify-center"
              onClick={() => void toggleCurrentSaved()}
              title="Track save is local only and does not add to your Discogs wantlist."
              aria-label={current.saved ? "Unsave current track" : "Save current track"}
            >
              {current.saved ? <HeartOff className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
              {current.saved ? "Saved" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void markRowReleaseListened(current.releaseId, current.trackId, current.releaseDiscogsUrl)}
              disabled={reviewingReleaseId === current.releaseId}
              className="h-10 w-full justify-center rounded-md border border-amber-400/60 bg-amber-500/22 text-black hover:bg-amber-500/32"
              title="Mark full release reviewed and skip to next release"
              aria-label="Mark current release reviewed"
            >
              {reviewingReleaseId === current.releaseId ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Release
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 outline-none">
        {visibleRows.map((item, index) => {
          const isPlaying = item.trackId === playingTrackId && playerIsPlaying;
          const isUpNext = Boolean(item.isUpNext) && !isPlaying;
          const playedCount = item.playedCount ?? (item.wasPlayed ? 1 : 0);
          const hasPlayedHistory = playedCount > 0;
          const needsMark = hasPlayedHistory && !item.listened;
          const wasPlayed = hasPlayedHistory && !needsMark;
          const labelIsActive = Boolean(item.labelActive) || activeLabelIds.has(item.labelId);
          const hasPlayableVideo =
            Boolean(item.youtubeVideoId) &&
            (item.playbackSource === "discogs" || item.videoEmbeddable !== false);
          const hardPlayBlockReason = youtubeQuotaExceeded
            ? "YouTube quota reached. Queue/play is temporarily disabled."
            : null;
          const playHint = !hasPlayableVideo
            ? "No linked playable video yet. Play Now will search and queue one."
            : null;
          const canPlay = hardPlayBlockReason === null;
          const isPlayLoading = loadingTrackId === item.trackId;

          return (
            <div
              key={item.trackId}
              className={`rounded-lg border p-3 ${
                isPlaying
                  ? "border-emerald-500/70 bg-emerald-500/10"
                  : index === activeCursor
                    ? "border-[var(--color-accent)] bg-[var(--color-surface2)]"
                    : "border-[var(--color-border)]"
              }`}
              onMouseEnter={() => setCursor(index)}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.trackId)}
                    onChange={(event) => toggleSelectTrack(item.trackId, event.target.checked)}
                    aria-label={`Select ${item.trackTitle}`}
                  />
                  <ReleaseArtwork src={item.releaseThumbUrl} title={item.releaseTitle} />
                  <div className="min-w-0">
                    {(() => {
                      const artistLine = (item.trackArtists || item.releaseArtist || "").trim();
                      return artistLine ? (
                        <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{artistLine}</p>
                      ) : null;
                    })()}
                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                      {item.position}
                      {" "}
                      {item.trackTitle}
                      <a
                        className="ml-1 inline-flex align-middle text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        href={toDiscogsWebUrl(item.releaseDiscogsUrl, "")}
                        target="_blank"
                        rel="noreferrer"
                        title="Open release on Discogs"
                        aria-label="Open release on Discogs"
                      >
                        <Disc3 className="h-3.5 w-3.5" />
                      </a>
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                      <span>{item.labelName}</span>
                      <span>•</span>
                      <a className="underline-offset-2 hover:underline" href={`/releases/${item.releaseId}`}>
                        {item.releaseTitle}
                        {item.releaseCatno ? <span className="ml-1 text-[var(--color-muted)]">({item.releaseCatno})</span> : null}
                      </a>
                      <span className="group relative ml-1 inline-flex">
                        <Button
                          type="button"
                          size="sm"
                          variant={item.releaseWishlist ? "secondary" : "ghost"}
                          disabled={wishlistReleaseIdLoading === item.releaseId}
                          className={`h-9 w-9 p-0 ${
                            item.releaseWishlist
                              ? "border border-amber-500/70 bg-amber-500/18 text-black hover:bg-amber-500/28 hover:text-black"
                              : "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)] hover:text-white"
                          }`}
                          onClick={() => void toggleRowRecordWishlist(item.releaseId)}
                          title={item.releaseWishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                          aria-label={item.releaseWishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                        >
                          {item.releaseWishlist ? (
                            <BookmarkCheck className="h-5 w-5 stroke-[2.35]" />
                          ) : (
                            <BookmarkPlus className="h-5 w-5 stroke-[2.35]" />
                          )}
                        </Button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {wishlistReleaseIdLoading === item.releaseId
                            ? "Updating wishlist..."
                            : item.releaseWishlist
                              ? "Remove from Discogs wishlist"
                              : "Add to Discogs wishlist"}
                        </span>
                      </span>
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
                      {item.saved ? <Badge className="border-fuchsia-600/50 text-fuchsia-300">Track Saved</Badge> : null}
                      {item.releaseWishlist ? (
                        <Badge className="border-amber-500/60 bg-amber-500/15 text-amber-200">
                          <BookmarkCheck className="mr-1 h-3 w-3" />
                          Wishlisted
                        </Badge>
                      ) : null}
                      {needsMark ? <Badge className="border-amber-600/50 text-amber-300">Needs Review</Badge> : null}
                      {wasPlayed ? <Badge className="border-zinc-600/50 text-zinc-300">Played{playedCount > 1 ? ` x${playedCount}` : ""}</Badge> : null}
                    </div>
                  </div>
                </div>
                {showQueueFilters ? (
                  <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
                    <a
                      href={toDiscogsWebUrl(item.releaseDiscogsUrl, "")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                      title="Open on Discogs"
                      aria-label="Open on Discogs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <span
                      className={`group relative inline-flex h-10 w-full min-w-0 ${canPlay ? "" : "cursor-not-allowed"}`}
                      aria-label={hardPlayBlockReason ?? playHint ?? "Play"}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-10 w-full justify-center"
                        onClick={() => void playRow(item.trackId)}
                        disabled={!canPlay || isPlayLoading}
                        title="Play now in the mini-player"
                        aria-label="Play now"
                      >
                        {isPlayLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {isPlayLoading ? "Loading..." : "Play Now"}
                      </Button>
                      {!canPlay && hardPlayBlockReason ? (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-amber-500/40 bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug text-amber-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {hardPlayBlockReason}
                        </span>
                      ) : null}
                      {canPlay && playHint ? (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {playHint}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-10 w-full justify-center rounded-md border border-emerald-400/60 bg-emerald-500/28 text-emerald-50 hover:bg-emerald-500/38"
                      onClick={() => void markRowListened(item.trackId)}
                      title="Mark this track reviewed and move to next track"
                      aria-label="Mark this track reviewed and move to next track"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void markRowReleaseListened(item.releaseId, item.trackId, item.releaseDiscogsUrl)}
                      disabled={reviewingReleaseId === item.releaseId}
                      className="h-10 w-full justify-center rounded-md border border-amber-400/60 bg-amber-500/22 text-black hover:bg-amber-500/32"
                      title="Mark entire release reviewed and skip to next release"
                      aria-label="Mark entire release reviewed and skip to next release"
                    >
                      {reviewingReleaseId === item.releaseId ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.saved ? "secondary" : "ghost"}
                      className="col-span-2 h-10 w-full justify-center"
                      onClick={() => void toggleRowSaved(item.trackId)}
                      title="Track save is local only and does not add to your Discogs wantlist."
                      aria-label={item.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                    >
                      {item.saved ? (
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
                  </div>
                ) : null}

                <div
                  className={
                    showQueueFilters
                      ? "hidden w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:ml-auto sm:grid sm:w-[31rem] sm:self-center sm:grid-cols-[2.25rem_8.5rem_2.25rem_2.25rem_8.5rem] sm:items-center sm:justify-end"
                      : "flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:self-center sm:flex-nowrap sm:justify-end"
                  }
                >
                  <a
                    href={toDiscogsWebUrl(item.releaseDiscogsUrl, "")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                    title="Open on Discogs"
                    aria-label="Open on Discogs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <span
                    className={`group relative inline-flex w-full min-w-0 sm:w-[8.5rem] ${canPlay ? "" : "cursor-not-allowed"}`}
                    aria-label={hardPlayBlockReason ?? playHint ?? "Play"}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center sm:w-[8.5rem] sm:justify-center"
                      onClick={() => void playRow(item.trackId)}
                      disabled={!canPlay || isPlayLoading}
                      title="Play now in the mini-player"
                      aria-label="Play now"
                    >
                      {isPlayLoading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {isPlayLoading ? "Loading..." : "Play Now"}
                    </Button>
                    {!canPlay && hardPlayBlockReason ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-amber-500/40 bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug text-amber-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {hardPlayBlockReason}
                      </span>
                    ) : null}
                    {canPlay && playHint ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {playHint}
                      </span>
                    ) : null}
                  </span>
                  {showQueueFilters ? (
                    <>
                      <span className="group relative inline-flex">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-9 w-9 rounded-full border border-emerald-400/60 bg-emerald-500/28 p-0 text-emerald-50 hover:bg-emerald-500/38"
                          onClick={() => void markRowListened(item.trackId)}
                          title="Mark this track reviewed and move to next track"
                          aria-label="Mark this track reviewed and move to next track"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          Mark this track reviewed and move to next track
                        </span>
                      </span>
                      <span className="group relative inline-flex">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void markRowReleaseListened(item.releaseId, item.trackId, item.releaseDiscogsUrl)}
                          disabled={reviewingReleaseId === item.releaseId}
                          className="h-9 w-9 rounded-full border border-amber-400/60 bg-amber-500/22 p-0 text-black hover:bg-amber-500/32"
                          title="Mark entire release reviewed and skip to next release"
                          aria-label="Mark entire release reviewed and skip to next release"
                        >
                          {reviewingReleaseId === item.releaseId ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                        </Button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          Mark entire release reviewed and skip to next release
                        </span>
                      </span>
                    </>
                  ) : (
                    (() => {
                      const isAdding = addingLabelReleaseId === item.releaseId;
                      const isAdded = addedLabelReleaseIds.includes(item.releaseId);
                      const isBusy = isAdding;
                      const canAddLabel = !labelIsActive;
                      if (!canAddLabel) {
                        return (
                          <span
                            className="inline-flex w-full items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 sm:w-[12rem]"
                            aria-label="Label active"
                            title="Label is already active"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Label active
                          </span>
                        );
                      }
                      return (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!canAddLabel) return;
                        void addRowLabel(item.releaseId);
                      }}
                      disabled={isBusy || isAdded}
                      title="Add this release label to DigQueue and activate it for processing."
                      aria-label="Add and activate label"
                      className="w-full justify-center border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] disabled:opacity-100 sm:w-[12rem]"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {isAdding
                        ? "Adding..."
                        : isAdded
                          ? "Added"
                        : "Add + activate label"}
                    </Button>
                      );
                    })()
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={item.saved ? "secondary" : "ghost"}
                    className={`w-full justify-center sm:w-[8.5rem] sm:justify-center ${showQueueFilters ? "col-span-2 sm:col-auto" : ""}`}
                    onClick={() => void toggleRowSaved(item.trackId)}
                    title="Track save is local only and does not add to your Discogs wantlist."
                    aria-label={item.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                  >
                    {item.saved ? (
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
                </div>
              </div>
            </div>
          );
        })}
        {visibleRows.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Nothing pending for this view.</p> : null}
      </div>
    </div>
  );
}
