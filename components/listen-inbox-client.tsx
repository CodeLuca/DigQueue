"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Disc3,
  ExternalLink,
  Heart,
  HeartOff,
  Play,
  PlusCircle,
  RefreshCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toDiscogsWebUrl } from "@/lib/discogs-links";

type ListenRow = {
  trackId: number;
  trackTitle: string;
  trackArtists?: string | null;
  position: string;
  duration: string | null;
  listened: boolean;
  saved: boolean;
  releaseId: number;
  releaseTitle: string;
  releaseArtist?: string | null;
  releaseDiscogsUrl: string;
  releaseThumbUrl: string | null;
  releaseWishlist: boolean;
  importSource?: string | null;
  labelId: number;
  labelName: string;
  hasChosenVideo?: boolean;
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
  track?: { id: number; title: string } | null;
  release?: { title: string } | null;
  label?: { name: string } | null;
};

const YOUTUBE_QUOTA_EVENT = "digqueue:youtube-quota-exceeded";
const YOUTUBE_QUOTA_CLEAR_EVENT = "digqueue:youtube-quota-cleared";
const YOUTUBE_QUOTA_STORAGE_KEY = "digqueue:youtube-quota-exceeded";
const TRACK_TODO_UPDATED_EVENT = "digqueue:track-todo-updated";
const RELEASE_WISHLIST_UPDATED_EVENT = "digqueue:release-wishlist-updated";
const LISTENING_SCOPE_EVENT = "digqueue:listening-scope";

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

async function enqueueTrack(trackId: number, queueMode: "normal" | "next" = "normal") {
  const response = await fetch("/api/queue/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackId, queueMode }),
  });
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; item?: QueueApiItem | null; error?: string; reason?: string }
    | null;
  if (body?.reason === "no_match") {
    throw new Error("NO_MATCH");
  }
  if (body?.reason === "youtube_quota_exceeded") {
    throw new Error("YOUTUBE_QUOTA_EXCEEDED");
  }
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "Unable to queue track.");
  }
  if (!body.item) throw new Error("Queued track not found.");
  return body.item;
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
      <img
        src={src}
        alt={`${title} artwork`}
        className={`${sizeClass} shrink-0 border border-[var(--color-border)] object-cover`}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`${sizeClass} shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)]`} aria-hidden />
  );
}

export function ListenInboxClient({
  initialRows,
  initialSelectedLabelId,
  labelOptions,
  showQueueFilters = true,
  showWishlistSourceFilter = false,
}: {
  initialRows: ListenRow[];
  initialSelectedLabelId?: number;
  labelOptions?: LabelOption[];
  showQueueFilters?: boolean;
  showWishlistSourceFilter?: boolean;
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
  const [wishlistSourceFilter, setWishlistSourceFilter] = useState<"all" | "saved_tracks" | "wishlisted_records">("all");
  const [hideReviewed, setHideReviewed] = useState(true);
  const [hideAlreadyPlayed, setHideAlreadyPlayed] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<"all" | "saved" | "wishlisted" | "saved_or_wishlisted">("all");
  const [videoFilter, setVideoFilter] = useState<"all" | "playable" | "no_video_or_private">("all");
  const [addingLabelReleaseId, setAddingLabelReleaseId] = useState<number | null>(null);
  const [togglingLabelId, setTogglingLabelId] = useState<number | null>(null);
  const [addedLabelReleaseIds, setAddedLabelReleaseIds] = useState<number[]>([]);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY) === "1";
  });
  const router = useRouter();

  const sourceFilteredRows = useMemo(
    () =>
      rows.filter((item) => {
        if (!showWishlistSourceFilter || wishlistSourceFilter === "all") return true;
        if (wishlistSourceFilter === "saved_tracks") return item.saved;
        return item.releaseWishlist;
      }),
    [rows, showWishlistSourceFilter, wishlistSourceFilter],
  );
  const wishlistSourceCounts = useMemo(() => {
    const savedTracks = rows.filter((item) => item.saved).length;
    const wishlistedRecords = rows.filter((item) => item.releaseWishlist).length;
    return { all: rows.length, savedTracks, wishlistedRecords };
  }, [rows]);
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
    if (!labelOptions || labelOptions.length === 0) return rowDerivedLabelOptions;
    const merged = new Map<number, LabelOption>();
    for (const item of rowDerivedLabelOptions) merged.set(item.id, item);
    for (const item of labelOptions) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [labelOptions, rowDerivedLabelOptions]);
  const activeLabelIds = useMemo(() => new Set((labelOptions ?? []).map((item) => item.id)), [labelOptions]);

  const selectedLabelStillExists = selectedLabelId !== null && effectiveLabelOptions.some((item) => item.id === selectedLabelId);
  const activeLabelId = selectedLabelStillExists ? selectedLabelId : null;
  const activeLabelIndex = activeLabelId === null ? -1 : effectiveLabelOptions.findIndex((item) => item.id === activeLabelId);
  const activeLabel = activeLabelId === null ? null : effectiveLabelOptions.find((item) => item.id === activeLabelId) ?? null;
  const scopedRows = useMemo(
    () => (activeLabelId === null ? sourceFilteredRows : sourceFilteredRows.filter((item) => item.labelId === activeLabelId)),
    [activeLabelId, sourceFilteredRows],
  );
  const queueFilterCounts = useMemo(() => {
    const reviewed = scopedRows.filter((item) => item.listened).length;
    const played = scopedRows.filter((item) => (item.playedCount ?? 0) > 0 || Boolean(item.wasPlayed)).length;
    const saved = scopedRows.filter((item) => item.saved).length;
    const wishlisted = scopedRows.filter((item) => item.releaseWishlist).length;
    const noVideoOrPrivate = scopedRows.filter((item) => !item.hasChosenVideo || item.videoEmbeddable === false).length;
    return { reviewed, played, saved, wishlisted, noVideoOrPrivate };
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
        }
        if (showQueueFilters && hideReviewed && item.listened) return false;
        const alreadyPlayed = (item.playedCount ?? 0) > 0 || Boolean(item.wasPlayed);
        if (showQueueFilters && hideAlreadyPlayed && alreadyPlayed) return false;
        return true;
      }),
    [hideAlreadyPlayed, hideReviewed, scopedRows, showQueueFilters, sourceFilter, videoFilter],
  );
  const activeCursor = Math.max(0, Math.min(cursor, Math.max(0, visibleRows.length - 1)));
  const current = visibleRows[activeCursor] ?? null;
  const filterButtonClass = (active: boolean) =>
    `rounded-md border px-2 py-1 font-medium transition ${
      active
        ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-surface2)_76%)] text-[var(--color-text)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
        : "border-[var(--color-border)] text-[var(--color-muted)] opacity-70 hover:opacity-100 hover:bg-[var(--color-surface)]"
    }`;
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

  const playRow = useCallback(async (trackId: number) => {
    if (youtubeQuotaExceeded) return;
    try {
      const item = await enqueueTrack(trackId, "next");
      window.dispatchEvent(new CustomEvent("digqueue:play-item", { detail: item }));
      setPlayingTrackId(trackId);
      setPlayerIsPlaying(true);
      setRows((prev) =>
        prev.map((row) =>
          row.trackId === trackId
            ? { ...row, isUpNext: true, wasPlayed: false, needsMark: false }
            : row,
        ),
      );
      setFeedback("Playing.");
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "NO_MATCH") {
        setRows((prev) => prev.filter((row) => row.trackId !== trackId));
        setFeedback(null);
        router.refresh();
        return;
      }
      if (error instanceof Error && error.message === "YOUTUBE_QUOTA_EXCEEDED") {
        setYoutubeQuotaExceeded(true);
        setFeedback("YouTube quota reached. Queue/play is temporarily disabled. You can still mark tracks listened.");
        window.sessionStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, "1");
        window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_EVENT));
        return;
      }
      const message = error instanceof Error ? error.message : "Unable to queue track.";
      setFeedback(message);
    }
  }, [router, youtubeQuotaExceeded]);

  const clearYoutubeQuotaExceeded = useCallback(() => {
    setYoutubeQuotaExceeded(false);
    setFeedback(null);
    window.sessionStorage.removeItem(YOUTUBE_QUOTA_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_CLEAR_EVENT));
  }, []);

  const syncUpNextFromQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/queue/list?limit=120");
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
    }
  }, []);

  const markCurrentListened = useCallback(async () => {
    if (!current) return;
    const wasPlaying = current.trackId === playingTrackId;
    const nextTrackId = wasPlaying
      ? (visibleRows[activeCursor + 1]?.trackId ?? visibleRows[activeCursor - 1]?.trackId ?? null)
      : null;
    await updateTracks({ trackIds: [current.trackId], field: "listened", mode: "set", value: true });
    setRows((prev) => {
      const next = prev.map((item) =>
        item.trackId === current.trackId
          ? { ...item, listened: true, isUpNext: false, needsMark: false }
          : item,
      );
      setCursor((cursorPrev) => Math.max(0, Math.min(cursorPrev, Math.max(0, next.length - 1))));
      return next;
    });
    if (wasPlaying) {
      if (nextTrackId) {
        void playRow(nextTrackId);
      } else {
        window.dispatchEvent(new CustomEvent("digqueue:next"));
      }
    }
    router.refresh();
  }, [activeCursor, current, playRow, playingTrackId, router, visibleRows]);

  const toggleCurrentSaved = useCallback(async () => {
    if (!current) return;
    const updated = await updateTracks({ trackIds: [current.trackId], field: "saved", mode: "toggle" });
    const nextSaved = updated.find((item) => item.trackId === current.trackId)?.saved ?? current.saved;
    setRows((prev) => {
      const next = prev.map((item) =>
        item.trackId === current.trackId
          ? { ...item, saved: nextSaved, isUpNext: false, needsMark: false }
          : item,
      );
      return showQueueFilters ? next : next.filter((item) => item.saved);
    });
    router.refresh();
  }, [current, router, showQueueFilters]);

  const markRowListened = useCallback(async (trackId: number) => {
    const wasPlaying = trackId === playingTrackId;
    const rowIndex = visibleRows.findIndex((item) => item.trackId === trackId);
    const nextTrackId = wasPlaying && rowIndex >= 0
      ? (visibleRows[rowIndex + 1]?.trackId ?? visibleRows[rowIndex - 1]?.trackId ?? null)
      : null;
    await updateTracks({ trackIds: [trackId], field: "listened", mode: "set", value: true });
    setRows((prev) => {
      const next = prev.map((row) =>
        row.trackId === trackId
          ? { ...row, listened: true, isUpNext: false, needsMark: false }
          : row,
      );
      setCursor((cursorPrev) => Math.max(0, Math.min(cursorPrev, Math.max(0, next.length - 1))));
      return next;
    });
    if (wasPlaying) {
      if (nextTrackId) {
        void playRow(nextTrackId);
      } else {
        window.dispatchEvent(new CustomEvent("digqueue:next"));
      }
    }
    router.refresh();
  }, [playRow, playingTrackId, router, visibleRows]);

  const toggleRowSaved = useCallback(async (trackId: number) => {
    const updated = await updateTracks({ trackIds: [trackId], field: "saved", mode: "toggle" });
    const updatedTrack = updated.find((item) => item.trackId === trackId);
    if (!updatedTrack) return;
    setRows((prev) => {
      const next = prev.map((row) =>
        row.trackId === trackId
          ? { ...row, saved: updatedTrack.saved, isUpNext: false, needsMark: false }
          : row,
      );
      return showQueueFilters ? next : next.filter((row) => row.saved);
    });
    router.refresh();
  }, [router, showQueueFilters]);

  const toggleRowRecordWishlist = useCallback(async (releaseId: number) => {
    try {
      const result = await updateReleaseWishlist({ releaseId, mode: "toggle" });
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
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update record wishlist.");
    }
  }, [router]);

  const addRowLabel = useCallback(async (releaseId: number) => {
    if (addingLabelReleaseId === releaseId) return;
    if (addedLabelReleaseIds.includes(releaseId)) return;
    setAddingLabelReleaseId(releaseId);
    setFeedback("Adding and activating label...");
    try {
      await addLabelFromRelease(releaseId);
      setAddedLabelReleaseIds((prev) => (prev.includes(releaseId) ? prev : [...prev, releaseId]));
      setFeedback("Label added and activated.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to add label.");
    } finally {
      setAddingLabelReleaseId(null);
    }
  }, [addedLabelReleaseIds, addingLabelReleaseId, router]);

  const setRowLabelActive = useCallback(async (labelId: number, active: boolean) => {
    if (togglingLabelId === labelId) return;
    setTogglingLabelId(labelId);
    setFeedback(active ? "Activating label..." : "Deactivating label...");
    try {
      const response = await fetch(`/api/labels/${labelId}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Unable to update label status.");
      setFeedback(active ? "Label activated." : "Label deactivated.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update label status.");
    } finally {
      setTogglingLabelId(null);
    }
  }, [router, togglingLabelId]);

  const toggleSelectTrack = useCallback((trackId: number, checked: boolean) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(trackId);
      else next.delete(trackId);
      return [...next];
    });
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
    setRows((prev) => prev.map((row) => (eligible.includes(row.trackId) ? { ...row, listened: true, isUpNext: false, needsMark: false } : row)));
    setSelectedTrackIds((prev) => prev.filter((id) => !eligible.includes(id)));
    setFeedback(`Marked ${eligible.length} tracks reviewed.`);
    router.refresh();
  }, [router, selectedVisibleRows]);

  const bulkSetSelectedSaved = useCallback(async (value: boolean) => {
    const ids = selectedVisibleRows.map((row) => row.trackId);
    if (ids.length === 0) return;
    await updateTracks({ trackIds: ids, field: "saved", mode: "set", value });
    setRows((prev) => {
      const next = prev.map((row) =>
        ids.includes(row.trackId)
          ? { ...row, saved: value, isUpNext: value ? false : row.isUpNext, needsMark: value ? false : row.needsMark }
          : row,
      );
      return showQueueFilters ? next : next.filter((row) => row.saved);
    });
    setSelectedTrackIds((prev) => prev.filter((id) => !ids.includes(id)));
    setFeedback(value ? `Saved ${ids.length} tracks.` : `Removed ${ids.length} saved tracks.`);
    router.refresh();
  }, [router, selectedVisibleRows, showQueueFilters]);

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
      if (!labelFilterTouched && !didAutoSelectPlayerLabel && selectedLabelId === null && nextTrackId) {
        const playerLabelId = labelIdByTrackId.get(nextTrackId);
        if (playerLabelId) {
          setSelectedLabelId(playerLabelId);
          setDidAutoSelectPlayerLabel(true);
        }
      }
      void syncUpNextFromQueue();
    };

    window.addEventListener("digqueue:player-current", onPlayerCurrent as EventListener);
    return () => window.removeEventListener("digqueue:player-current", onPlayerCurrent as EventListener);
  }, [didAutoSelectPlayerLabel, labelFilterTouched, labelIdByTrackId, selectedLabelId, syncUpNextFromQueue]);

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
    const interval = window.setInterval(() => void syncUpNextFromQueue(), 8000);
    window.dispatchEvent(new CustomEvent("digqueue:request-player-current"));
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [syncUpNextFromQueue]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(LISTENING_SCOPE_EVENT, {
        detail: {
          enabled: showQueueFilters,
          trackIds: visibleRows.map((row) => row.trackId),
          activeLabelId,
        },
      }),
    );
  }, [activeLabelId, showQueueFilters, visibleRows]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => moveLabel(-1)} disabled={effectiveLabelOptions.length === 0} title="Select previous label">
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
            className="h-9 min-w-[220px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            title="Filter tracks by label"
            aria-label="Filter tracks by label"
          >
            <option value="">All labels</option>
            {effectiveLabelOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => moveLabel(1)} disabled={effectiveLabelOptions.length === 0} title="Select next label">
            <ChevronRight className="h-3.5 w-3.5" />
            Next label
          </Button>
          {activeLabel?.discogsUrl ? (
            <a
              href={toDiscogsWebUrl(activeLabel.discogsUrl, `/label/${activeLabel.id}`)}
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
            <span className="text-xs text-[var(--color-muted)]">
              {activeLabelIndex + 1}/{effectiveLabelOptions.length}
            </span>
          ) : null}
          {showWishlistSourceFilter ? (
            <div className="ml-2 flex items-center gap-1 text-xs">
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
            <div className="ml-2 flex flex-wrap items-center gap-1 text-xs">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Source</span>
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={filterButtonClass(sourceFilter === "all")}
                aria-pressed={sourceFilter === "all"}
                title="Show all tracks regardless of saved/wishlist status"
                aria-label="Source filter all tracks"
              >
                All ({sourceFilterCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("saved")}
                className={filterButtonClass(sourceFilter === "saved")}
                aria-pressed={sourceFilter === "saved"}
                title="Show only tracks saved locally"
                aria-label="Source filter saved tracks"
              >
                Saved ({sourceFilterCounts.saved})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("wishlisted")}
                className={filterButtonClass(sourceFilter === "wishlisted")}
                aria-pressed={sourceFilter === "wishlisted"}
                title="Show only tracks from Discogs wishlisted records"
                aria-label="Source filter wishlisted tracks"
              >
                Wishlisted ({sourceFilterCounts.wishlisted})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("saved_or_wishlisted")}
                className={filterButtonClass(sourceFilter === "saved_or_wishlisted")}
                aria-pressed={sourceFilter === "saved_or_wishlisted"}
                title="Show tracks that are either saved or from wishlisted records"
                aria-label="Source filter saved or wishlisted"
              >
                Saved or Wishlisted ({sourceFilterCounts.savedOrWishlisted})
              </button>
              {sourceFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSourceFilter("all")}
                  className="ml-1 text-[11px] text-[var(--color-accent)] hover:underline"
                  title="Reset source filter"
                  aria-label="Reset source filter"
                >
                  Source filter active: {sourceFilter.replaceAll("_", " ")} (reset)
                </button>
              ) : (
                <span className="ml-1 text-[11px] text-[var(--color-muted)]">Source filter: all</span>
              )}
              <span className="ml-2 mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Video</span>
              <button
                type="button"
                onClick={() => setVideoFilter("all")}
                className={filterButtonClass(videoFilter === "all")}
                aria-pressed={videoFilter === "all"}
                title="Show tracks with and without playable videos"
                aria-label="Video filter all tracks"
              >
                Any ({videoFilterCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setVideoFilter("playable")}
                className={filterButtonClass(videoFilter === "playable")}
                aria-pressed={videoFilter === "playable"}
                title="Show only tracks with playable videos"
                aria-label="Video filter playable only"
              >
                Playable ({videoFilterCounts.playable})
              </button>
              <button
                type="button"
                onClick={() => setVideoFilter("no_video_or_private")}
                className={filterButtonClass(videoFilter === "no_video_or_private")}
                aria-pressed={videoFilter === "no_video_or_private"}
                title="Show only tracks missing a playable video"
                aria-label="Video filter no video or private"
              >
                No video/private ({videoFilterCounts.noVideoOrPrivate})
              </button>
              <span className="ml-2 mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">State</span>
              <button
                type="button"
                onClick={() => setHideReviewed((prev) => !prev)}
                className={filterButtonClass(hideReviewed)}
                aria-pressed={hideReviewed}
                title="Hide tracks already marked reviewed"
                aria-label="Toggle hide reviewed tracks"
              >
                Hide reviewed ({queueFilterCounts.reviewed})
              </button>
              <button
                type="button"
                onClick={() => setHideAlreadyPlayed((prev) => !prev)}
                className={filterButtonClass(hideAlreadyPlayed)}
                aria-pressed={hideAlreadyPlayed}
                title="Hide tracks that already played"
                aria-label="Toggle hide played tracks"
              >
                Hide played ({queueFilterCounts.played})
              </button>
            </div>
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Button type="button" size="sm" variant="outline" onClick={selectVisibleTracks} disabled={visibleRows.length === 0} title="Select every track currently visible">
            <CheckSquare className="h-3.5 w-3.5" />
            Select all
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clearSelectedTracks} disabled={selectedTrackIds.length === 0} title="Clear all selected tracks">
            <X className="h-3.5 w-3.5" />
            Clear selection
          </Button>
          <span className="text-[var(--color-muted)]">{selectedVisibleRows.length} selected</span>
          {showQueueFilters ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void bulkSetSelectedListened()} disabled={selectedVisibleRows.length === 0} title="Mark selected tracks as reviewed">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark selected reviewed
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void bulkSetSelectedSaved(true)}
            disabled={selectedVisibleRows.length === 0}
            title="Track save is local only and does not add to your Discogs wantlist."
            aria-label="Save selected tracks. Does not add to your Discogs wantlist."
          >
            <Heart className="h-3.5 w-3.5" />
            Save selected
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void bulkSetSelectedSaved(false)} disabled={selectedVisibleRows.length === 0} title="Remove selected tracks from local saved list">
            <HeartOff className="h-3.5 w-3.5" />
            Unsave selected
          </Button>
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

      <div className="space-y-2 outline-none">
        {visibleRows.map((item, index) => {
          const isLegacyWant = item.importSource === "discogs_want";
          const isPlaying = item.trackId === playingTrackId && playerIsPlaying;
          const isUpNext = Boolean(item.isUpNext) && !isPlaying;
          const playedCount = item.playedCount ?? (item.wasPlayed ? 1 : 0);
          const wasPlayed = playedCount > 0 && !isUpNext;
          const needsMark = Boolean(item.needsMark) && !isUpNext;
          const playUnavailableReason = youtubeQuotaExceeded
            ? "YouTube quota reached. Queue/play is temporarily disabled."
            : item.videoEmbeddable === false
                ? "Private or restricted video selected. Choose another match to play."
                : null;
          const canPlay = playUnavailableReason === null;

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
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <p className="line-clamp-1 text-sm font-medium">
                      {item.position}
                      {" "}
                      {item.trackTitle}
                      <a
                        className="ml-1 inline-flex align-middle text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        href={toDiscogsWebUrl(item.releaseDiscogsUrl, `/release/${item.releaseId}`)}
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
                      <a className="underline-offset-2 hover:underline" href={`/releases/${item.releaseId}`}>{item.releaseTitle}</a>
                      <span className="group relative ml-1 inline-flex">
                        <Button
                          type="button"
                          size="sm"
                          variant={item.releaseWishlist ? "secondary" : "ghost"}
                          className={`h-6 w-6 p-0 ${
                            item.releaseWishlist
                              ? "border border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:text-amber-100"
                              : "border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"
                          }`}
                          onClick={() => void toggleRowRecordWishlist(item.releaseId)}
                          title={item.releaseWishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                          aria-label={item.releaseWishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                        >
                          {item.releaseWishlist ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                        </Button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {item.releaseWishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
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
                      {wasPlayed ? <Badge className="border-zinc-600/50 text-zinc-300">Played{playedCount > 1 ? ` x${playedCount}` : ""}</Badge> : null}
                      {needsMark ? <Badge className="border-amber-600/50 text-amber-300">Needs Mark</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={toDiscogsWebUrl(item.releaseDiscogsUrl, `/release/${item.releaseId}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                    title="Open on Discogs"
                    aria-label="Open on Discogs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <span
                    className={`group relative inline-flex ${canPlay ? "" : "cursor-not-allowed"}`}
                    aria-label={playUnavailableReason ?? "Play"}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void playRow(item.trackId)}
                      disabled={!canPlay}
                      title="Play now in the mini-player"
                      aria-label="Play now"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Play Now
                    </Button>
                    {!canPlay && playUnavailableReason ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute -top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-md border border-amber-500/40 bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1.5 text-[11px] leading-snug text-amber-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        {playUnavailableReason}
                      </span>
                    ) : null}
                  </span>
                  {!isLegacyWant && showQueueFilters ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void markRowListened(item.trackId)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Reviewed
                    </Button>
                  ) : (
                    (() => {
                      const labelIsActive = activeLabelIds.has(item.labelId);
                      const isAdding = addingLabelReleaseId === item.releaseId;
                      const isToggling = togglingLabelId === item.labelId;
                      const isAdded = addedLabelReleaseIds.includes(item.releaseId);
                      const isBusy = isAdding || isToggling;
                      const wantsDeactivate = labelIsActive && !isAdding;
                      return (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (wantsDeactivate) {
                          void setRowLabelActive(item.labelId, false);
                          return;
                        }
                        void addRowLabel(item.releaseId);
                      }}
                      disabled={isBusy || (!wantsDeactivate && isAdded)}
                      title={wantsDeactivate ? "Deactivate this label for processing." : "Add this release label to DigQueue and activate it for processing."}
                      aria-label={wantsDeactivate ? "Deactivate label" : "Add and activate label"}
                      className="border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] disabled:opacity-100"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {isToggling
                        ? "Updating..."
                        : isAdding
                        ? "Adding..."
                        : !wantsDeactivate && isAdded
                          ? "Added"
                          : wantsDeactivate
                            ? "Deactivate label"
                            : "Add + activate label"}
                    </Button>
                      );
                    })()
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={item.saved ? "secondary" : "ghost"}
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
