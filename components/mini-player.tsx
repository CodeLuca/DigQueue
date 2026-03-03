"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  BookmarkCheck,
  BookmarkPlus,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Disc3,
  ExternalLink,
  Heart,
  HeartOff,
  ListOrdered,
  Pause,
  Play,
  Loader2,
  Shuffle,
  SkipBack,
  X,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDiscogsWebUrl } from "@/lib/discogs-links";

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    __digqueueSingletonPlayer?: YTPlayer | null;
  }
}

type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  destroy?: () => void;
  mute?: () => void;
  unMute?: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
};

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
  priority?: number;
  source?: string;
  track?: { id: number; title: string; artistsText?: string | null; saved?: boolean; listened?: boolean; bpm?: number | null } | null;
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

type ReleaseDetailsApiResponse = {
  id: number;
  title: string;
  uri?: string;
  artists_sort?: string;
  artists?: Array<{ name?: string }>;
  styles?: string[];
  genres?: string[];
  country?: string;
  year?: number;
  formats?: Array<{ name?: string; descriptions?: string[] }>;
  labels?: Array<{ name?: string; catno?: string }>;
  images?: Array<{ uri?: string; uri150?: string }>;
  community?: {
    want?: number;
    have?: number;
    rating?: { average?: number; count?: number };
  };
  marketStats?: {
    lowest_price?: number | null;
    median_price?: number | null;
    num_for_sale?: number;
    blocked_from_sale?: boolean;
    currency?: string;
  } | null;
  priceSuggestions?: Record<string, { value?: number | null; currency?: string } | number | null> | null;
  tracklist?: Array<unknown>;
  videos?: Array<{ uri?: string; title?: string }>;
};

type FinderCandidate = {
  provider: "bandcamp" | "juno" | "hardwax" | "phonica" | "discogs";
  url: string;
  title: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reason: string;
};

type FinderLinksApiResponse = {
  bestBandcamp?: FinderCandidate | null;
  bandcamp?: FinderCandidate[];
  fallback?: FinderCandidate[];
};

const TRACK_TODO_UPDATED_EVENT = "digqueue:track-todo-updated";
const RELEASE_WISHLIST_UPDATED_EVENT = "digqueue:release-wishlist-updated";
const LISTENING_SCOPE_EVENT = "digqueue:listening-scope";
const PLAYBACK_MODE_EVENT = "digqueue:playback-mode";
const PLAYBACK_MODE_STORAGE_KEY = "digqueue:playback-mode";
const PLAYBACK_OWNER_STORAGE_KEY = "digqueue:playback-owner";
const PLAYBACK_OWNER_TTL_MS = 12000;
const REQUEST_TIMEOUT_MS = 15000;
const BULK_REQUEST_TIMEOUT_MS = 30000;
const BPM_SAMPLE_INTERVAL_MS = 50;
const BPM_ESTIMATE_INTERVAL_MS = 1200;
const BPM_WINDOW_SECONDS = 16;
const BPM_AVG_WINDOW_SIZE = 6;
const BPM_MIN = 70;
const BPM_MAX = 200;
type PlaybackMode = "in_order" | "shuffle";
type ReleaseWishlistApiResponse = {
  ok?: boolean;
  wishlist?: boolean;
  error?: string;
  affectedReleaseIds?: number[];
  affectedTrackCount?: number;
  localConfirmedAll?: boolean;
  discogsSynced?: boolean;
};
type TodoApiResponse = {
  ok?: boolean;
  tracks?: Array<{ trackId: number; listened: boolean; saved: boolean }>;
  error?: string;
};
type ReleaseReviewedApiResponse = {
  ok?: boolean;
  tracks?: Array<{ trackId: number; listened: boolean; saved: boolean }>;
  error?: string;
};

type ListeningScopeDetail = {
  enabled?: boolean;
  trackIds?: number[];
  activeLabelId?: number | null;
};

type PlaybackOwnerState = {
  tabId: string;
  updatedAt: number;
};

function estimateBpmFromEnvelope(samples: number[], sampleIntervalMs: number): number | null {
  if (samples.length < 40) return null;
  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  const centered = samples.map((value) => value - mean);
  const minLag = Math.floor((60_000 / BPM_MAX) / sampleIntervalMs);
  const maxLag = Math.ceil((60_000 / BPM_MIN) / sampleIntervalMs);
  let bestLag = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let index = lag; index < centered.length; index += 1) {
      score += centered[index] * centered[index - lag];
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag <= 0 || !Number.isFinite(bestScore) || bestScore <= 0) return null;
  const bpm = Math.round(60_000 / (bestLag * sampleIntervalMs));
  return bpm >= BPM_MIN && bpm <= BPM_MAX ? bpm : null;
}

function normalizeElectronicBpm(raw: number) {
  let bpm = raw;
  while (bpm < 110) bpm *= 2;
  while (bpm > 165) bpm = Math.round(bpm / 2);
  return Math.round(bpm);
}

export function MiniPlayer() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  const isListeningStationTab = activeTab === "step-2" || activeTab === "step-3";
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingPlayItemRef = useRef<QueueApiItem | null>(null);
  const currentRef = useRef<QueueApiItem | null>(null);
  const loadNextRef = useRef<((action?: "played" | "listened" | null, currentId?: number) => Promise<boolean>) | null>(null);
  const loadNextRequestRef = useRef<Promise<boolean> | null>(null);
  const handlingEndedForIdRef = useRef<number | null>(null);
  const middlePreviewPreparedForIdRef = useRef<number | null>(null);
  const middlePreviewEndRef = useRef<number | null>(null);
  const middlePreviewAdvancedForIdRef = useRef<number | null>(null);
  const manualSeekOverrideForIdRef = useRef<number | null>(null);
  const middlePreviewSeekPendingForIdRef = useRef<number | null>(null);
  const markReviewedInFlightRef = useRef(false);
  const markReleaseReviewedInFlightRef = useRef(false);
  const toggleSavedInFlightRef = useRef(false);
  const toggleWishlistInFlightRef = useRef(false);
  const listeningScopeTrackIdsRef = useRef<number[]>([]);
  const listeningScopeEnabledRef = useRef(false);
  const syncedScopeKeyRef = useRef<string>("");
  const lastQueueDedupeAtRef = useRef(0);
  const releaseDetailsCacheRef = useRef(new Map<number, ReleaseDetailsApiResponse>());
  const releaseLinksCacheRef = useRef(new Map<number, FinderLinksApiResponse>());
  const tabIdRef = useRef(`tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const wasPlayingBeforeHiddenRef = useRef(false);
  const bpmCaptureStreamRef = useRef<MediaStream | null>(null);
  const bpmAudioContextRef = useRef<AudioContext | null>(null);
  const bpmAnalyserRef = useRef<AnalyserNode | null>(null);
  const bpmSampleBufferRef = useRef<Float32Array | null>(null);
  const bpmEnvelopeRef = useRef<number[]>([]);
  const bpmEstimateHistoryRef = useRef<number[]>([]);
  const bpmSampleTimerRef = useRef<number | null>(null);
  const bpmEstimateTimerRef = useRef<number | null>(null);
  const liveBpmStatusRef = useRef<"off" | "starting" | "detecting" | "running" | "error">("off");
  const [current, setCurrent] = useState<QueueApiItem | null>(null);
  const [history, setHistory] = useState<QueueApiItem[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [todoLoading, setTodoLoading] = useState<"reviewed" | "reviewed_release" | "saved" | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItemsState, setQueueItemsState] = useState<QueueApiItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [releaseDetails, setReleaseDetails] = useState<ReleaseDetailsApiResponse | null>(null);
  const [releaseDetailsLoading, setReleaseDetailsLoading] = useState(false);
  const [releaseDetailsError, setReleaseDetailsError] = useState<string | null>(null);
  const [releaseLinks, setReleaseLinks] = useState<FinderLinksApiResponse | null>(null);
  const [releaseLinksLoading, setReleaseLinksLoading] = useState(false);
  const [releaseLinksError, setReleaseLinksError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("in_order");
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [liveBpmConfidence, setLiveBpmConfidence] = useState<"low" | "mid" | "high">("low");
  const [liveBpmStatus, setLiveBpmStatus] = useState<"off" | "starting" | "detecting" | "running" | "error">("off");
  const [liveBpmError, setLiveBpmError] = useState<string | null>(null);
  const [liveBpmInputSource, setLiveBpmInputSource] = useState<"tab" | "mic" | null>(null);

  useEffect(() => {
    liveBpmStatusRef.current = liveBpmStatus;
  }, [liveBpmStatus]);
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }, []);

  const syncQueueToListeningScope = useCallback(async (options?: { force?: boolean }) => {
    if (!isListeningStationTab || !listeningScopeEnabledRef.current) return;
    const trackIds = listeningScopeTrackIdsRef.current;
    if (trackIds.length === 0) return;
    const scopeKey = `${trackIds.join(",")}`;
    if (!options?.force && scopeKey === syncedScopeKeyRef.current) return;
    syncedScopeKeyRef.current = scopeKey;
    try {
      await fetch("/api/queue/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, trackIds }),
      });
    } catch {
      // Scope sync is best-effort; don't block playback controls.
    }
  }, [isListeningStationTab]);

  const fetchWithTimeout = useCallback(async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const readPlaybackOwner = useCallback((): PlaybackOwnerState | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(PLAYBACK_OWNER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PlaybackOwnerState>;
      if (typeof parsed.tabId !== "string" || typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) return null;
      return { tabId: parsed.tabId, updatedAt: parsed.updatedAt };
    } catch {
      return null;
    }
  }, []);

  const writePlaybackOwner = useCallback((state: PlaybackOwnerState) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PLAYBACK_OWNER_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const clearPlaybackOwnerIfOwned = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = readPlaybackOwner();
      if (existing?.tabId === tabIdRef.current) {
        window.localStorage.removeItem(PLAYBACK_OWNER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [readPlaybackOwner]);

  const ensurePlaybackOwnership = useCallback((showNotice = true) => {
    const now = Date.now();
    const owner = readPlaybackOwner();
    const ownerIsFresh = owner && now - owner.updatedAt < PLAYBACK_OWNER_TTL_MS;
    if (ownerIsFresh && owner.tabId !== tabIdRef.current) {
      if (showNotice) {
        setActionNotice("Audio is active in another tab. Pause there or use that tab.");
      }
      return false;
    }
    writePlaybackOwner({ tabId: tabIdRef.current, updatedAt: now });
    return true;
  }, [readPlaybackOwner, writePlaybackOwner]);

  const fetchQueueItems = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const now = Date.now();
      if (now - lastQueueDedupeAtRef.current > 60_000) {
        lastQueueDedupeAtRef.current = now;
        void fetch("/api/queue/maintenance/dedupe", { method: "POST" }).catch(() => null);
      }
      const response = await fetch("/api/queue/list?limit=30");
      if (!response.ok) throw new Error("Unable to load queue.");
      const body = (await response.json()) as { items?: QueueApiItem[] };
      const items = body.items ?? [];
      if (isListeningStationTab && listeningScopeEnabledRef.current) {
        const allowedTrackIds = new Set(listeningScopeTrackIdsRef.current);
        setQueueItemsState(items.filter((item) => (item.track?.id ? allowedTrackIds.has(item.track.id) : false)));
      } else {
        setQueueItemsState(items);
      }
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to load queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [isListeningStationTab]);

  const updateTrackTodo = useCallback(async (payload: {
    trackIds: number[];
    field: "listened" | "saved";
    mode?: "set" | "toggle";
    value?: boolean;
  }) => {
    const response = await fetchWithTimeout("/api/tracks/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as TodoApiResponse | null;
    if (!response.ok || !body?.ok) {
      if (response.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(body?.error || "Unable to update track.");
    }
    return body;
  }, [fetchWithTimeout]);

  const updateReleaseWishlist = useCallback(async (payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean }) => {
    const response = await fetchWithTimeout("/api/releases/wishlist", {
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
  }, [fetchWithTimeout]);

  const markReleaseReviewed = useCallback(async (releaseId: number) => {
    const response = await fetchWithTimeout("/api/releases/reviewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId }),
    }, BULK_REQUEST_TIMEOUT_MS);
    const body = (await response.json().catch(() => null)) as ReleaseReviewedApiResponse | null;
    if (!response.ok || !body?.ok) {
      throw new Error(body?.error || "Unable to mark release reviewed.");
    }
    return body;
  }, [fetchWithTimeout]);

  const setGlobalPlaybackMode = useCallback((nextMode: PlaybackMode) => {
    setPlaybackMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, nextMode);
      window.dispatchEvent(new CustomEvent(PLAYBACK_MODE_EVENT, { detail: { mode: nextMode } }));
    }
  }, []);

  useEffect(() => {
    currentRef.current = current;
    if (current?.id && handlingEndedForIdRef.current !== null && handlingEndedForIdRef.current !== current.id) {
      handlingEndedForIdRef.current = null;
    }
    if (current?.id && middlePreviewPreparedForIdRef.current !== null && middlePreviewPreparedForIdRef.current !== current.id) {
      middlePreviewPreparedForIdRef.current = null;
      middlePreviewEndRef.current = null;
      middlePreviewAdvancedForIdRef.current = null;
      manualSeekOverrideForIdRef.current = null;
      middlePreviewSeekPendingForIdRef.current = current.id;
    }
  }, [current]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeoutId = window.setTimeout(() => setActionNotice(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  const loadNext = useCallback(async (action: "played" | "listened" | null = null, currentId?: number) => {
    if (loadNextRequestRef.current) return loadNextRequestRef.current;
    const request = (async () => {
      const activeMode = "hybrid";
      const activeOrder = playbackMode;
      void syncQueueToListeningScope().catch(() => null);
      const activeCurrentId = currentId ?? currentRef.current?.id;
      const response = action && activeCurrentId && activeCurrentId > 0
        ? await fetch("/api/queue/next", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentId: activeCurrentId, action, mode: activeMode, order: activeOrder }),
          })
        : await fetch(`/api/queue/next?mode=${activeMode}&order=${activeOrder}`);
      if (!response.ok) return false;
      let item = (await response.json()) as QueueApiItem | null;
      if (!item && isListeningStationTab && listeningScopeEnabledRef.current) {
        await syncQueueToListeningScope({ force: true });
        const scopedRetry = await fetch(`/api/queue/next?mode=${activeMode}&order=${activeOrder}`);
        if (scopedRetry.ok) {
          item = (await scopedRetry.json()) as QueueApiItem | null;
        }
      }
      if (!item && action) {
        const fallback = await fetch(`/api/queue/next?mode=${activeMode}&order=${activeOrder}`);
        if (fallback.ok) {
          item = (await fallback.json()) as QueueApiItem | null;
        }
      }
      if (!item) {
        if (action) {
          if (playerRef.current) {
            if (playerRef.current.stopVideo) playerRef.current.stopVideo();
            else playerRef.current.pauseVideo();
          }
          setCurrent(null);
          setPlaying(false);
          setCurrentTime(0);
          setDuration(0);
        }
        return true;
      }

      const previousCurrent = currentRef.current;
      const isSameQueueItem = previousCurrent?.id === item.id;
      const isSameVideoTrack =
        previousCurrent?.youtubeVideoId === item.youtubeVideoId &&
        (previousCurrent?.track?.id ?? null) === (item.track?.id ?? null);
      // Only suppress duplicate reloads for passive fetches.
      // When user explicitly marks played/listened, allow advancing even if
      // the next candidate points to the same media.
      if (!action && (isSameQueueItem || isSameVideoTrack)) {
        setCurrent(item);
        return true;
      }
      if (previousCurrent) {
        setHistory((prev) => [previousCurrent, ...prev].slice(0, 50));
      }
      setCurrent(item);
      if (playerRef.current) {
        if (!ensurePlaybackOwnership()) return true;
        playerRef.current.loadVideoById(item.youtubeVideoId);
        setPlaying(true);
      }
      return true;
    })();
    loadNextRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (loadNextRequestRef.current === request) {
        loadNextRequestRef.current = null;
      }
    }
  }, [ensurePlaybackOwnership, isListeningStationTab, playbackMode, syncQueueToListeningScope]);

  useEffect(() => {
    loadNextRef.current = loadNext;
  }, [loadNext]);

  const markReviewed = useCallback(async () => {
    if (markReviewedInFlightRef.current) return;
    markReviewedInFlightRef.current = true;
    const trackId = current?.track?.id ?? null;
    setTodoLoading("reviewed");
    try {
      if (trackId) {
        const body = await updateTrackTodo({ trackIds: [trackId], field: "listened", mode: "set", value: true });
        const listenedValue = body.tracks?.find((item) => item.trackId === trackId)?.listened ?? true;
        window.dispatchEvent(
          new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
            detail: { trackId, field: "listened", value: listenedValue },
          }),
        );
        await loadNext("played");
        return;
      }
      await loadNext("played");
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Unable to update track.");
    } finally {
      markReviewedInFlightRef.current = false;
      setTodoLoading(null);
    }
  }, [current?.track?.id, loadNext, updateTrackTodo]);

  const markEntireReleaseReviewed = useCallback(async () => {
    if (markReleaseReviewedInFlightRef.current) return;
    const releaseId = current?.release?.id;
    if (!releaseId) return;
    markReleaseReviewedInFlightRef.current = true;
    setTodoLoading("reviewed_release");
    try {
      const body = await markReleaseReviewed(releaseId);
      for (const track of body.tracks ?? []) {
        window.dispatchEvent(
          new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
            detail: { trackId: track.trackId, field: "listened", value: Boolean(track.listened) },
          }),
        );
      }
      // Skip any queued items still tied to the same release so this action
      // consistently lands on the next release in queue.
      let advanced = await loadNext("played");
      let attempts = 0;
      while (advanced && currentRef.current?.release?.id === releaseId && attempts < 8) {
        attempts += 1;
        advanced = await loadNext("played");
      }
      if (!advanced || currentRef.current?.release?.id === releaseId) {
        setActionNotice("Release marked reviewed. End of queue reached.");
      }
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Unable to mark release reviewed.");
    } finally {
      markReleaseReviewedInFlightRef.current = false;
      setTodoLoading(null);
    }
  }, [current?.release?.id, loadNext, markReleaseReviewed]);

  const toggleSaved = useCallback(async () => {
    if (toggleSavedInFlightRef.current) return;
    if (!current?.track?.id) return;
    toggleSavedInFlightRef.current = true;
    setTodoLoading("saved");
    try {
      const trackId = current.track.id;
      const body = await updateTrackTodo({ trackIds: [trackId], field: "saved", mode: "toggle" });
      const updatedTrack = body.tracks?.find((item) => item.trackId === trackId);
      const nextSaved = typeof updatedTrack?.saved === "boolean" ? updatedTrack.saved : !Boolean(currentRef.current?.track?.saved);
      setCurrent((prev) => {
        if (!prev?.track || prev.track.id !== trackId) return prev;
        return { ...prev, track: { ...prev.track, saved: nextSaved } };
      });
      window.dispatchEvent(
        new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
          detail: { trackId, field: "saved", value: nextSaved },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("digqueue:player-current", {
          detail: {
            trackId,
            queueItemId: currentRef.current?.id ?? null,
            saved: nextSaved,
            listened: currentRef.current?.track?.listened ?? null,
            playing,
          },
        }),
      );
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Unable to update track.");
    } finally {
      toggleSavedInFlightRef.current = false;
      setTodoLoading(null);
    }
  }, [current?.track?.id, playing, updateTrackTodo]);

  const toggleCurrentReleaseWishlist = useCallback(async () => {
    if (toggleWishlistInFlightRef.current) return;
    const releaseId = current?.release?.id;
    if (!releaseId) return;
    toggleWishlistInFlightRef.current = true;
    const currentWishlist = Boolean(current?.release?.wishlist);
    setWishlistLoading(true);
    try {
      const result = await updateReleaseWishlist({ releaseId, mode: "set", value: !currentWishlist });
      setCurrent((prev) => {
        if (!prev?.release || prev.release.id !== releaseId) return prev;
        return { ...prev, release: { ...prev.release, wishlist: result.wishlist } };
      });
      window.dispatchEvent(
        new CustomEvent(RELEASE_WISHLIST_UPDATED_EVENT, {
          detail: { releaseId, releaseIds: result.affectedReleaseIds, value: result.wishlist },
        }),
      );
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Unable to update record wishlist.");
    } finally {
      toggleWishlistInFlightRef.current = false;
      setWishlistLoading(false);
    }
  }, [current?.release?.id, current?.release?.wishlist, updateReleaseWishlist]);

  const loadPrev = useCallback(() => {
    const previous = history[0];
    if (!previous || !playerRef.current) return;
    setHistory((prev) => prev.slice(1));
    setCurrent(previous);
    playerRef.current.loadVideoById(previous.youtubeVideoId);
    setPlaying(true);
  }, [history]);

  const loadSpecific = useCallback(async (item: QueueApiItem) => {
    const previousCurrent = currentRef.current;
    const switchingToDifferentItem = previousCurrent?.id && previousCurrent.id !== item.id;
    const sameVideoTrack =
      previousCurrent?.youtubeVideoId === item.youtubeVideoId &&
      (previousCurrent?.track?.id ?? null) === (item.track?.id ?? null);
    if (!switchingToDifferentItem && sameVideoTrack) {
      setCurrent(item);
      return;
    }

    if (switchingToDifferentItem && previousCurrent && previousCurrent.id > 0) {
      // Manual "play now" should advance queue state for the item being replaced.
      void fetch("/api/queue/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentId: previousCurrent.id, action: "played", mode: "hybrid", order: playbackMode }),
      }).catch(() => null);
    }

    if (!playerRef.current || !ready) {
      pendingPlayItemRef.current = item;
      setCurrent(item);
      return;
    }
    if (switchingToDifferentItem && previousCurrent) {
      setHistory((prev) => [previousCurrent, ...prev].slice(0, 50));
    }
    // Keep selected item in DB until it actually finishes/gets reviewed so played history persists.
    if (item.id > 0) {
      setQueueItemsState((prev) => prev.filter((entry) => entry.id !== item.id));
    }
    if (!ensurePlaybackOwnership()) return;
    setCurrent(item);
    playerRef.current.loadVideoById(item.youtubeVideoId);
    setPlaying(true);
  }, [ensurePlaybackOwnership, playbackMode, ready]);

  useEffect(() => {
    if (!isListeningStationTab) {
      listeningScopeEnabledRef.current = false;
      listeningScopeTrackIdsRef.current = [];
    }
  }, [isListeningStationTab]);

  useEffect(() => {
    const onListeningScope = (event: Event) => {
      const custom = event as CustomEvent<ListeningScopeDetail>;
      const trackIds = (custom.detail?.trackIds ?? []).filter((value): value is number => Number.isFinite(value) && value > 0);
      listeningScopeTrackIdsRef.current = trackIds;
      listeningScopeEnabledRef.current = Boolean(custom.detail?.enabled);
      if (!isListeningStationTab) return;
      void syncQueueToListeningScope()
        .then(() => {
          if (queueOpen) return fetchQueueItems();
          return undefined;
        })
        .catch(() => null);
    };

    window.addEventListener(LISTENING_SCOPE_EVENT, onListeningScope as EventListener);
    return () => window.removeEventListener(LISTENING_SCOPE_EVENT, onListeningScope as EventListener);
  }, [fetchQueueItems, isListeningStationTab, queueOpen, syncQueueToListeningScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY);
    if (stored === "shuffle" || stored === "in_order") {
      setPlaybackMode(stored);
    }
  }, []);

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

  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return;
      const singleton = window.__digqueueSingletonPlayer;
      if (singleton) {
        try {
          singleton.stopVideo?.();
          singleton.pauseVideo();
          singleton.destroy?.();
        } catch {
          // Ignore stale singleton teardown errors.
        }
        window.__digqueueSingletonPlayer = null;
      }
      playerRef.current = new window.YT.Player("digqueue-youtube-player", {
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            const pendingItem = pendingPlayItemRef.current;
            if (pendingItem) {
              pendingPlayItemRef.current = null;
              setCurrent(pendingItem);
              if (!ensurePlaybackOwnership()) return;
              playerRef.current?.loadVideoById(pendingItem.youtubeVideoId);
              setPlaying(true);
              return;
            }
            void loadNextRef.current?.();
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              const finishedId = currentRef.current?.id;
              if (!finishedId || handlingEndedForIdRef.current === finishedId) return;
              if (manualSeekOverrideForIdRef.current === finishedId) return;
              handlingEndedForIdRef.current = finishedId;
              void loadNextRef.current?.("played", finishedId);
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (!ensurePlaybackOwnership(false)) {
                playerRef.current?.pauseVideo();
                return;
              }
              wasPlayingBeforeHiddenRef.current = false;
              setPlaying(true);
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
              if (typeof document !== "undefined" && document.hidden) {
                wasPlayingBeforeHiddenRef.current = true;
                return;
              }
              clearPlaybackOwnerIfOwned();
            }
          },
        },
      });
      window.__digqueueSingletonPlayer = playerRef.current;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }

      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initPlayer();
      };
    }

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
      const activePlayer = playerRef.current;
      if (activePlayer) {
        try {
          activePlayer.stopVideo?.();
          activePlayer.pauseVideo();
          activePlayer.destroy?.();
        } catch {
          // Ignore teardown errors during unmount.
        }
      }
      if (window.__digqueueSingletonPlayer === activePlayer) {
        window.__digqueueSingletonPlayer = null;
      }
      playerRef.current = null;
      setReady(false);
    };
  }, [clearPlaybackOwnerIfOwned, ensurePlaybackOwnership]);

  const maybeAutoAdvanceAtTrackEnd = useCallback(() => {
    const player = playerRef.current;
    const itemId = currentRef.current?.id;
    if (!player || !itemId) return;
    if (manualSeekOverrideForIdRef.current === itemId) return;
    if (handlingEndedForIdRef.current === itemId) return;

    const nextDuration = player.getDuration?.() ?? 0;
    const nextCurrent = player.getCurrentTime?.() ?? 0;
    if (!Number.isFinite(nextDuration) || !Number.isFinite(nextCurrent) || nextDuration <= 0) return;

    const remaining = nextDuration - nextCurrent;
    if (remaining > 0.45) return;

    const endedState = typeof window !== "undefined" && window.YT?.PlayerState ? window.YT.PlayerState.ENDED : 0;
    const pausedState = typeof window !== "undefined" && window.YT?.PlayerState ? window.YT.PlayerState.PAUSED : 2;
    const state = player.getPlayerState?.();
    const shouldAdvance = state === endedState || (state === pausedState && (playing || wasPlayingBeforeHiddenRef.current));
    if (!shouldAdvance) return;

    handlingEndedForIdRef.current = itemId;
    void loadNext("played", itemId);
  }, [loadNext, playing]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        wasPlayingBeforeHiddenRef.current = playing;
        return;
      }
      maybeAutoAdvanceAtTrackEnd();
      const shouldResume = wasPlayingBeforeHiddenRef.current;
      wasPlayingBeforeHiddenRef.current = false;
      if (!shouldResume || !isIOS || !playerRef.current || !ready || !currentRef.current) return;
      if (!ensurePlaybackOwnership(false)) return;
      window.setTimeout(() => {
        playerRef.current?.playVideo();
      }, 120);
    };

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        wasPlayingBeforeHiddenRef.current = playing;
        return;
      }
      clearPlaybackOwnerIfOwned();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (!isIOS || !ready || !playerRef.current || !currentRef.current) return;
      if (!wasPlayingBeforeHiddenRef.current) return;
      if (!ensurePlaybackOwnership(false)) return;
      window.setTimeout(() => {
        playerRef.current?.playVideo();
      }, 120);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [clearPlaybackOwnerIfOwned, ensurePlaybackOwnership, isIOS, maybeAutoAdvanceAtTrackEnd, playing, ready]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const mediaSession = navigator.mediaSession;

    if (typeof window !== "undefined" && "MediaMetadata" in window) {
      mediaSession.metadata = current
        ? new MediaMetadata({
            title: current.track?.title || "Now Playing",
            artist: current.track?.artistsText || current.release?.artist || "Unknown artist",
            album: current.release?.title || "",
            artwork: current.release?.thumbUrl
              ? [{ src: current.release.thumbUrl, sizes: "128x128", type: "image/jpeg" }]
              : undefined,
          })
        : null;
    }
    mediaSession.playbackState = playing ? "playing" : "paused";

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions are not supported on all browsers/platforms.
      }
    };

    setHandler("play", () => {
      if (!playerRef.current) return;
      if (!ensurePlaybackOwnership()) return;
      playerRef.current.playVideo();
    });
    setHandler("pause", () => {
      playerRef.current?.pauseVideo();
    });
    setHandler("nexttrack", () => {
      void loadNext("played");
    });
    setHandler("previoustrack", () => {
      loadPrev();
    });

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("nexttrack", null);
      setHandler("previoustrack", null);
    };
  }, [
    current,
    ensurePlaybackOwnership,
    loadNext,
    loadPrev,
    playing,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!playerRef.current || !ready) return;
      const nextDuration = playerRef.current.getDuration?.() ?? 0;
      const nextCurrent = playerRef.current.getCurrentTime?.() ?? 0;
      const itemId = currentRef.current?.id;
      if (Number.isFinite(nextDuration) && nextDuration >= 0) setDuration(nextDuration);
      if (Number.isFinite(nextCurrent) && nextCurrent >= 0) setCurrentTime(nextCurrent);

      if (!itemId || !Number.isFinite(nextDuration) || !Number.isFinite(nextCurrent) || nextDuration <= 0) return;

      if (middlePreviewPreparedForIdRef.current !== itemId) {
        middlePreviewPreparedForIdRef.current = itemId;
        middlePreviewAdvancedForIdRef.current = null;
        middlePreviewSeekPendingForIdRef.current = itemId;
        if (nextDuration > 240 && manualSeekOverrideForIdRef.current !== itemId) {
          const start = Math.max(0, (nextDuration - 240) / 2);
          const end = Math.min(nextDuration, start + 240);
          middlePreviewEndRef.current = end;
          if (middlePreviewSeekPendingForIdRef.current === itemId) {
            playerRef.current.mute?.();
            playerRef.current.seekTo(start, true);
            setCurrentTime(start);
            window.setTimeout(() => {
              if (currentRef.current?.id === itemId) {
                playerRef.current?.unMute?.();
              }
            }, 120);
            middlePreviewSeekPendingForIdRef.current = null;
          }
        } else {
          middlePreviewEndRef.current = null;
          middlePreviewSeekPendingForIdRef.current = null;
        }
      }

      if (middlePreviewEndRef.current !== null && nextCurrent >= middlePreviewEndRef.current - 0.25) {
        if (manualSeekOverrideForIdRef.current === itemId) return;
        if (middlePreviewAdvancedForIdRef.current === itemId) return;
        middlePreviewAdvancedForIdRef.current = itemId;
        handlingEndedForIdRef.current = itemId;
        void loadNext("played", itemId);
      }

      // Fallback for background-tab throttling where iframe "ENDED" can be missed.
      maybeAutoAdvanceAtTrackEnd();
    }, 200);
    return () => window.clearInterval(interval);
  }, [loadNext, maybeAutoAdvanceAtTrackEnd, ready]);

  useEffect(() => {
    const playPause = () => {
      if (!playerRef.current || !ready) return;
      if (!current) {
        void loadNext();
        return;
      }
      if (playing) {
        playerRef.current.pauseVideo();
      } else {
        if (!ensurePlaybackOwnership()) return;
        playerRef.current.playVideo();
      }
    };

    const next = () => void loadNext("played");
    const prev = () => loadPrev();
    const reviewedCurrent = () => void markReviewed();

    const playItem = (event: Event) => {
      const custom = event as CustomEvent<QueueApiItem>;
      if (!custom.detail) return;
      loadSpecific(custom.detail);
    };

    window.addEventListener("digqueue:playpause", playPause);
    window.addEventListener("digqueue:next", next);
    window.addEventListener("digqueue:prev", prev);
    window.addEventListener("digqueue:reviewed-current", reviewedCurrent);
    // Backward compatibility for older shortcut/event emitters.
    window.addEventListener("digqueue:done-current", reviewedCurrent);
    window.addEventListener("digqueue:play-item", playItem as EventListener);

    return () => {
      window.removeEventListener("digqueue:playpause", playPause);
      window.removeEventListener("digqueue:next", next);
      window.removeEventListener("digqueue:prev", prev);
      window.removeEventListener("digqueue:reviewed-current", reviewedCurrent);
      window.removeEventListener("digqueue:done-current", reviewedCurrent);
      window.removeEventListener("digqueue:play-item", playItem as EventListener);
    };
  }, [current, ensurePlaybackOwnership, loadNext, loadPrev, loadSpecific, markReviewed, playing, ready]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const playPause = () => {
      if (!playerRef.current || !ready) return;
      if (!current) {
        void loadNext();
        return;
      }
      if (playing) {
        playerRef.current.pauseVideo();
      } else {
        if (!ensurePlaybackOwnership()) return;
        playerRef.current.playVideo();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      const code = event.code;
      const key = event.key;

      if (code === "MediaTrackNext" || key === "MediaTrackNext" || key === "MediaNextTrack" || key === "AudioTrackNext") {
        event.preventDefault();
        void loadNext("played");
        return;
      }

      if (code === "MediaTrackPrevious" || key === "MediaTrackPrevious" || key === "MediaPreviousTrack" || key === "AudioTrackPrevious") {
        event.preventDefault();
        loadPrev();
        return;
      }

      if (
        code === "MediaPlayPause" ||
        key === "MediaPlayPause" ||
        key === "AudioPlay" ||
        key === "AudioPause" ||
        key === "AudioPlayPause"
      ) {
        event.preventDefault();
        playPause();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [current, ensurePlaybackOwnership, loadNext, loadPrev, playing, ready]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!playing) return;
      const owner = readPlaybackOwner();
      if (owner?.tabId === tabIdRef.current) {
        writePlaybackOwner({ tabId: tabIdRef.current, updatedAt: Date.now() });
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [playing, readPlaybackOwner, writePlaybackOwner]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PLAYBACK_OWNER_STORAGE_KEY) return;
      if (!playerRef.current) return;
      if (!playing) return;
      const owner = readPlaybackOwner();
      if (owner && owner.tabId !== tabIdRef.current) {
        playerRef.current.pauseVideo();
        setPlaying(false);
        setActionNotice("Playback moved to another tab.");
      }
    };

    const onBeforeUnload = () => {
      clearPlaybackOwnerIfOwned();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [clearPlaybackOwnerIfOwned, playing, readPlaybackOwner]);

  const releaseMeta = useMemo(() => {
    if (!current) return "Queue is empty";
    return [current.label?.name?.trim(), current.release?.title?.trim()].filter(Boolean).join(" • ");
  }, [current]);
  const stopLiveBpmCapture = useCallback(() => {
    if (bpmSampleTimerRef.current) {
      window.clearInterval(bpmSampleTimerRef.current);
      bpmSampleTimerRef.current = null;
    }
    if (bpmEstimateTimerRef.current) {
      window.clearInterval(bpmEstimateTimerRef.current);
      bpmEstimateTimerRef.current = null;
    }
    bpmEnvelopeRef.current = [];
    bpmEstimateHistoryRef.current = [];
    bpmSampleBufferRef.current = null;
    bpmAnalyserRef.current = null;
    if (bpmAudioContextRef.current) {
      void bpmAudioContextRef.current.close().catch(() => null);
      bpmAudioContextRef.current = null;
    }
    if (bpmCaptureStreamRef.current) {
      for (const track of bpmCaptureStreamRef.current.getTracks()) {
        track.stop();
      }
      bpmCaptureStreamRef.current = null;
    }
    setLiveBpm(null);
    setLiveBpmConfidence("low");
    setLiveBpmStatus("off");
    setLiveBpmError(null);
    setLiveBpmInputSource(null);
  }, []);

  const startLiveBpmCapture = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices) {
      setLiveBpmStatus("error");
      setLiveBpmError("Live BPM capture is not supported in this browser.");
      return;
    }
    stopLiveBpmCapture();
    setLiveBpm(null);
    setLiveBpmConfidence("low");
    setLiveBpmError(null);
    setLiveBpmInputSource(null);
    setLiveBpmStatus("starting");

    const attachStream = (stream: MediaStream, inputSource: "tab" | "mic") => {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error(inputSource === "tab" ? "No tab audio track was shared." : "Microphone audio track unavailable.");
      }
      const audioContext = new AudioContext();
      void audioContext.resume().catch(() => null);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      const mediaSource = audioContext.createMediaStreamSource(stream);
      mediaSource.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      bpmCaptureStreamRef.current = stream;
      bpmAudioContextRef.current = audioContext;
      bpmAnalyserRef.current = analyser;
      bpmSampleBufferRef.current = buffer;
      bpmEnvelopeRef.current = [];
      bpmEstimateHistoryRef.current = [];
      setLiveBpmConfidence("low");
      setLiveBpmInputSource(inputSource);
      setLiveBpmStatus("detecting");
      const maxSamples = Math.floor((BPM_WINDOW_SECONDS * 1000) / BPM_SAMPLE_INTERVAL_MS);

      bpmSampleTimerRef.current = window.setInterval(() => {
        const activeAnalyser = bpmAnalyserRef.current;
        const activeBuffer = bpmSampleBufferRef.current;
        if (!activeAnalyser || !activeBuffer) return;
        activeAnalyser.getFloatTimeDomainData(activeBuffer);
        let energy = 0;
        for (let index = 0; index < activeBuffer.length; index += 1) {
          const sample = activeBuffer[index];
          energy += sample * sample;
        }
        const rms = Math.sqrt(energy / activeBuffer.length);
        const envelope = bpmEnvelopeRef.current;
        envelope.push(rms);
        if (envelope.length > maxSamples) {
          envelope.splice(0, envelope.length - maxSamples);
        }
      }, BPM_SAMPLE_INTERVAL_MS);

      bpmEstimateTimerRef.current = window.setInterval(() => {
        const estimated = estimateBpmFromEnvelope(bpmEnvelopeRef.current, BPM_SAMPLE_INTERVAL_MS);
        if (typeof estimated === "number") {
          const history = bpmEstimateHistoryRef.current;
          history.push(normalizeElectronicBpm(estimated));
          if (history.length > BPM_AVG_WINDOW_SIZE) {
            history.splice(0, history.length - BPM_AVG_WINDOW_SIZE);
          }
          const avg = Math.round(history.reduce((sum, value) => sum + value, 0) / history.length);
          const variance =
            history.length > 1
              ? history.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / history.length
              : 99;
          const stdDev = Math.sqrt(variance);
          const confidence: "low" | "mid" | "high" =
            history.length >= 4 && stdDev <= 2 ? "high" : history.length >= 3 && stdDev <= 4 ? "mid" : "low";
          setLiveBpmConfidence(confidence);
          setLiveBpm(confidence === "low" ? null : avg);
          setLiveBpmStatus("running");
        } else {
          setLiveBpmConfidence("low");
          setLiveBpmStatus((previous) => (previous === "running" ? "running" : "detecting"));
        }
      }, BPM_ESTIMATE_INTERVAL_MS);

      audioTracks[0]?.addEventListener(
        "ended",
        () => {
          stopLiveBpmCapture();
        },
        { once: true },
      );
    };

    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error("TAB_CAPTURE_UNAVAILABLE");
      }
      const tabStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      } as DisplayMediaStreamOptions);
      try {
        attachStream(tabStream, "tab");
        return;
      } catch (attachError) {
        for (const track of tabStream.getTracks()) track.stop();
        throw attachError;
      }
    } catch {
      try {
        if (!navigator.mediaDevices.getUserMedia) {
          throw new Error("MIC_CAPTURE_UNAVAILABLE");
        }
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        attachStream(micStream, "mic");
        setActionNotice("Live BPM is using microphone input (tab audio unavailable).");
        return;
      } catch (micError) {
        stopLiveBpmCapture();
        setLiveBpmStatus("error");
        setLiveBpmError(micError instanceof Error ? micError.message : "Unable to start live BPM capture.");
      }
    }
  }, [stopLiveBpmCapture]);

  useEffect(() => {
    return () => {
      stopLiveBpmCapture();
    };
  }, [stopLiveBpmCapture]);

  useEffect(() => {
    const status = liveBpmStatusRef.current;
    if (status === "off" || status === "error") return;
    // New track/video: clear previous estimates so old BPM does not carry over.
    bpmEnvelopeRef.current = [];
    bpmEstimateHistoryRef.current = [];
    setLiveBpm(null);
    setLiveBpmConfidence("low");
    setLiveBpmStatus("detecting");
  }, [current?.youtubeVideoId]);

  const currentBpmLabel = useMemo(() => {
    if (liveBpmStatus === "error") return liveBpmError ?? "BPM unavailable";
    if (liveBpmStatus === "starting" || liveBpmStatus === "detecting") return "Detecting";
    if (liveBpmStatus === "running" && typeof liveBpm === "number") return liveBpmConfidence === "high" ? "Stable" : "Estimating";
    return "Off";
  }, [liveBpm, liveBpmConfidence, liveBpmError, liveBpmStatus]);
  const currentBpmValue =
    typeof liveBpm === "number"
      ? liveBpmConfidence === "high"
        ? String(liveBpm)
        : `~${liveBpm}`
      : "--";
  const bpmInputLabel = liveBpmInputSource === "mic" ? "Mic input" : liveBpmInputSource === "tab" ? "Tab audio" : null;

  const currentReleaseId = current?.release?.id;

  const currentArtist = useMemo(() => {
    if (!releaseDetails) return null;
    const leadArtist = releaseDetails.artists_sort?.trim() || releaseDetails.artists?.[0]?.name?.trim();
    return leadArtist || null;
  }, [releaseDetails]);

  const currentArtistLine = useMemo(
    () => current?.track?.artistsText?.trim() || current?.release?.artist?.trim() || currentArtist || "Unknown artist",
    [current?.release?.artist, current?.track?.artistsText, currentArtist],
  );

  const currentCatalogNumber = useMemo(
    () => current?.release?.catno?.trim() || releaseDetails?.labels?.[0]?.catno?.trim() || null,
    [current?.release?.catno, releaseDetails],
  );

  const currentLabel = useMemo(() => {
    if (!releaseDetails) return null;
    const primary = releaseDetails.labels?.[0];
    if (!primary?.name) return null;
    return primary.catno ? `${primary.name} (${primary.catno})` : primary.name;
  }, [releaseDetails]);

  const currentFormats = useMemo(() => {
    if (!releaseDetails?.formats?.length) return null;
    return releaseDetails.formats
      .map((format) => [format.name, ...(format.descriptions ?? [])].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join(", ");
  }, [releaseDetails]);

  const currentGenreStyles = useMemo(() => {
    if (!releaseDetails) return null;
    const values = [...(releaseDetails.genres ?? []), ...(releaseDetails.styles ?? [])].filter(Boolean);
    return values.length ? values.join(", ") : null;
  }, [releaseDetails]);

  const expandedArtworkUrl = useMemo(() => {
    const releaseImage = releaseDetails?.images?.[0];
    return releaseImage?.uri || releaseImage?.uri150 || current?.release?.thumbUrl || null;
  }, [current?.release?.thumbUrl, releaseDetails]);

  const discogsReleaseUrl = useMemo(() => {
    if (releaseDetails?.uri?.trim()) {
      return `https://www.discogs.com${releaseDetails.uri.trim()}`;
    }
    if (!current?.release?.id) return null;
    return toDiscogsWebUrl(current.release.discogsUrl ?? "", "");
  }, [current?.release?.discogsUrl, current?.release?.id, releaseDetails?.uri]);

  const releaseVideoUrl = useMemo(
    () => releaseDetails?.videos?.find((video) => video?.uri?.trim())?.uri?.trim() || null,
    [releaseDetails?.videos],
  );

  const marketCurrency = useMemo(() => {
    const fromStats = releaseDetails?.marketStats?.currency?.trim();
    if (fromStats) return fromStats;
    const suggestions = releaseDetails?.priceSuggestions;
    if (!suggestions) return "USD";
    for (const value of Object.values(suggestions)) {
      if (value && typeof value === "object" && typeof value.currency === "string" && value.currency.trim()) {
        return value.currency.trim();
      }
    }
    return "USD";
  }, [releaseDetails?.marketStats?.currency, releaseDetails?.priceSuggestions]);

  const marketSpreadPercent = useMemo(() => {
    const lowest = releaseDetails?.marketStats?.lowest_price;
    const median = releaseDetails?.marketStats?.median_price;
    if (typeof lowest !== "number" || !Number.isFinite(lowest) || lowest <= 0) return null;
    if (typeof median !== "number" || !Number.isFinite(median) || median <= 0) return null;
    return Math.max(0, Math.round(((median - lowest) / lowest) * 100));
  }, [releaseDetails?.marketStats?.lowest_price, releaseDetails?.marketStats?.median_price]);

  const priceSuggestionRows = useMemo(() => {
    const suggestions = releaseDetails?.priceSuggestions;
    if (!suggestions) return [] as Array<{ label: string; value: number }>;
    const conditionOrder = [
      "Mint (M)",
      "Near Mint (NM or M-)",
      "Very Good Plus (VG+)",
      "Very Good (VG)",
      "Good Plus (G+)",
      "Good (G)",
      "Fair (F)",
      "Poor (P)",
    ];
    const rows = Object.entries(suggestions)
      .map(([label, value]) => {
        const amount =
          typeof value === "number" ? value : value && typeof value === "object" && typeof value.value === "number" ? value.value : null;
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
        return { label, value: amount };
      })
      .filter((row): row is { label: string; value: number } => row !== null);
    rows.sort((a, b) => {
      const ai = conditionOrder.indexOf(a.label);
      const bi = conditionOrder.indexOf(b.label);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return rows.slice(0, 6);
  }, [releaseDetails?.priceSuggestions]);

  const primaryBandcampLink = useMemo(() => releaseLinks?.bestBandcamp?.url?.trim() || null, [releaseLinks?.bestBandcamp?.url]);
  const fallbackShopLinks = useMemo(
    () => (releaseLinks?.fallback ?? []).filter((candidate) => candidate.provider !== "discogs").slice(0, 3),
    [releaseLinks?.fallback],
  );

  const sliderMax = Math.max(1, Math.floor(duration || 0));
  const sliderValue = Math.min(sliderMax, Math.max(0, Math.floor(currentTime || 0)));
  const currentYoutubeUrl = useMemo(
    () => (current?.youtubeVideoId ? `https://www.youtube.com/watch?v=${current.youtubeVideoId}` : null),
    [current?.youtubeVideoId],
  );

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const formatPrice = (amount?: number | null, currency?: string) => {
    if (typeof amount !== "number" || !Number.isFinite(amount)) return "n/a";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const openCurrentInYouTubeApp = useCallback(() => {
    if (!current?.youtubeVideoId) return;
    const watchUrl = `https://www.youtube.com/watch?v=${current.youtubeVideoId}`;
    if (!isIOS) {
      window.open(watchUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // iOS cannot keep iframe playback alive after Safari closes, so hand off to YouTube.
    window.location.href = `youtube://www.youtube.com/watch?v=${current.youtubeVideoId}`;
    window.setTimeout(() => {
      window.open(watchUrl, "_blank", "noopener,noreferrer");
    }, 700);
  }, [current?.youtubeVideoId, isIOS]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("digqueue:player-current", {
        detail: {
          trackId: current?.track?.id ?? null,
          queueItemId: current?.id ?? null,
          saved: current?.track?.saved ?? null,
          listened: current?.track?.listened ?? null,
          playing,
        },
      }),
    );
  }, [current, playing]);

  useEffect(() => {
    const onRequestCurrent = () => {
      window.dispatchEvent(
        new CustomEvent("digqueue:player-current", {
          detail: {
            trackId: currentRef.current?.track?.id ?? null,
            queueItemId: currentRef.current?.id ?? null,
            saved: currentRef.current?.track?.saved ?? null,
            listened: currentRef.current?.track?.listened ?? null,
            playing,
          },
        }),
      );
    };

    window.addEventListener("digqueue:request-player-current", onRequestCurrent);
    return () => window.removeEventListener("digqueue:request-player-current", onRequestCurrent);
  }, [playing]);

  useEffect(() => {
    const onTrackTodoUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ trackId?: number; field?: "saved" | "listened"; value?: boolean }>;
      const trackId = custom.detail?.trackId;
      const field = custom.detail?.field;
      const value = custom.detail?.value;
      if (typeof trackId !== "number" || (field !== "saved" && field !== "listened") || typeof value !== "boolean") return;

      setCurrent((prev) => {
        if (!prev?.track || prev.track.id !== trackId) return prev;
        if (field === "saved") return { ...prev, track: { ...prev.track, saved: value } };
        return { ...prev, track: { ...prev.track, listened: value } };
      });
    };

    window.addEventListener(TRACK_TODO_UPDATED_EVENT, onTrackTodoUpdated as EventListener);
    return () => window.removeEventListener(TRACK_TODO_UPDATED_EVENT, onTrackTodoUpdated as EventListener);
  }, []);

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
      setCurrent((prev) => {
        if (!prev?.release || !affected.has(prev.release.id ?? -1)) return prev;
        return { ...prev, release: { ...prev.release, wishlist: value } };
      });
    };

    window.addEventListener(RELEASE_WISHLIST_UPDATED_EVENT, onReleaseWishlistUpdated as EventListener);
    return () => window.removeEventListener(RELEASE_WISHLIST_UPDATED_EVENT, onReleaseWishlistUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (!queueOpen) return;
    void fetchQueueItems();
    const interval = window.setInterval(() => void fetchQueueItems(), 10000);
    return () => window.clearInterval(interval);
  }, [fetchQueueItems, queueOpen]);

  useEffect(() => {
    if (!expandedOpen) return;
    if (!currentReleaseId) {
      setReleaseDetails(null);
      setReleaseDetailsError("No release selected.");
      setReleaseDetailsLoading(false);
      return;
    }

    const cached = releaseDetailsCacheRef.current.get(currentReleaseId);
    if (cached) {
      setReleaseDetails(cached);
      setReleaseDetailsError(null);
      setReleaseDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setReleaseDetailsLoading(true);
    setReleaseDetailsError(null);
    setReleaseDetails(null);
    fetch(`/api/discogs/release/${currentReleaseId}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as unknown;
        if (
          !response.ok ||
          !body ||
          typeof body !== "object" ||
          !("id" in body) ||
          !("title" in body)
        ) {
          const message =
            body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
              ? (body as { error: string }).error
              : "Unable to load release info.";
          throw new Error(message);
        }
        if (cancelled) return;
        const parsed = body as ReleaseDetailsApiResponse;
        releaseDetailsCacheRef.current.set(currentReleaseId, parsed);
        setReleaseDetails(parsed);
      })
      .catch((error) => {
        if (cancelled) return;
        setReleaseDetails(null);
        setReleaseDetailsError(error instanceof Error ? error.message : "Unable to load release info.");
      })
      .finally(() => {
        if (cancelled) return;
        setReleaseDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentReleaseId, expandedOpen]);

  useEffect(() => {
    if (!expandedOpen || !currentReleaseId) {
      setReleaseLinks(null);
      setReleaseLinksError(null);
      setReleaseLinksLoading(false);
      return;
    }

    const cached = releaseLinksCacheRef.current.get(currentReleaseId);
    if (cached) {
      setReleaseLinks(cached);
      setReleaseLinksError(null);
      setReleaseLinksLoading(false);
      return;
    }

    let cancelled = false;
    setReleaseLinksLoading(true);
    setReleaseLinksError(null);
    setReleaseLinks(null);
    fetch(`/api/finder/release/${currentReleaseId}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as unknown;
        if (!response.ok || !body || typeof body !== "object") {
          const message =
            body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
              ? (body as { error: string }).error
              : "Unable to load link suggestions.";
          throw new Error(message);
        }
        if (cancelled) return;
        const parsed = body as FinderLinksApiResponse;
        releaseLinksCacheRef.current.set(currentReleaseId, parsed);
        setReleaseLinks(parsed);
      })
      .catch((error) => {
        if (cancelled) return;
        setReleaseLinks(null);
        setReleaseLinksError(error instanceof Error ? error.message : "Unable to load link suggestions.");
      })
      .finally(() => {
        if (cancelled) return;
        setReleaseLinksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentReleaseId, expandedOpen]);

  const playQueueItemNow = useCallback((item: QueueApiItem) => {
    loadSpecific(item);
    setQueueOpen(false);
  }, [loadSpecific]);

  const removeQueueItem = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/queue/item/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to remove queue item.");
      setQueueItemsState((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to remove queue item.");
    }
  }, []);

  const iconButtonClass =
    "h-8 w-8 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] p-0 text-[var(--color-text)] hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 sm:h-9 sm:w-9";
  const tooltipClass =
    "pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-surface)_90%,black_10%)] px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:px-4">
      {queueOpen ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-40 mb-2 flex justify-center px-4">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[100vh] bg-black/40" aria-hidden />
          <div className="pointer-events-auto relative z-10 w-full max-w-[900px] rounded-xl border border-[color-mix(in_oklab,var(--color-border)_78%,white_22%)] bg-[color-mix(in_oklab,var(--color-surface2)_88%,black_12%)] shadow-[0_32px_96px_rgba(0,0,0,0.72),0_12px_36px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <p className="text-sm font-semibold">Up Next ({queueItemsState.length})</p>
              <button
                type="button"
                onClick={() => setQueueOpen(false)}
                className="rounded-md border border-[var(--color-border)] p-1 hover:bg-[var(--color-surface)]"
                aria-label="Close queue overlay"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto p-2">
              {queueLoading ? <p className="p-2 text-xs text-[var(--color-muted)]">Loading queue…</p> : null}
              {queueError ? <p className="p-2 text-xs text-rose-300">{queueError}</p> : null}
              {!queueLoading && queueItemsState.length === 0 ? <p className="p-2 text-xs text-[var(--color-muted)]">Queue is empty.</p> : null}
              <div className="space-y-2">
                {queueItemsState.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      {item.release?.thumbUrl ? (
                        <Image
                          src={item.release.thumbUrl}
                          alt={`${item.release.title ?? item.track?.title ?? "Queue item"} artwork`}
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded border border-[var(--color-border)] object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-xs font-medium">{item.track?.title || item.release?.title || "Untitled"}</p>
                        <p className="line-clamp-1 text-[11px] text-[var(--color-muted)]">
                          {item.label?.name || "Unknown label"} • {item.release?.title || "Unknown release"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(item.priority ?? 0) > 0 ? (
                        <span className="rounded border border-[var(--color-accent)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">NEXT</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => playQueueItemNow(item)}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase hover:bg-[var(--color-surface)]"
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeQueueItem(item.id)}
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] uppercase hover:bg-[var(--color-surface)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {expandedOpen ? (
        <div className="mx-auto mb-2 max-w-[1400px] rounded-xl border border-[var(--color-border)] bg-[linear-gradient(130deg,color-mix(in_oklab,var(--color-surface2)_86%,black_14%),color-mix(in_oklab,var(--color-surface)_78%,black_22%))] p-3">
          {releaseDetailsLoading ? <p className="text-xs text-[var(--color-muted)]">Loading Discogs details…</p> : null}
          {releaseDetailsError ? <p className="text-xs text-rose-300">{releaseDetailsError}</p> : null}
          {!releaseDetailsLoading && !releaseDetailsError && releaseDetails ? (
            <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
              <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-2.5">
                {expandedArtworkUrl ? (
                  <Image
                    src={expandedArtworkUrl}
                    alt={`${current?.release?.title || releaseDetails.title || "Release"} artwork`}
                    width={900}
                    height={900}
                    className="aspect-square w-full rounded-md border border-[var(--color-border)] object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]" />
                )}
                <div className="mt-2.5 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Now Playing</p>
                  <p className="line-clamp-2 text-sm font-semibold">{current?.track?.title || "Unknown track"}</p>
                  <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{currentArtist || "Unknown artist"}</p>
                  <p className="line-clamp-2 text-xs text-[var(--color-muted)]">{current?.release?.title || releaseDetails.title || "Unknown release"}</p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Release Snapshot</p>
                  <p className="mt-1 text-sm font-medium">{releaseDetails.title}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{releaseDetails.year || "n/a"} • {releaseDetails.country || "n/a"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{currentLabel || "Label unknown"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{currentFormats || "Format unknown"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{currentGenreStyles || "No genre/style tags"}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Market Snapshot</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Median</p>
                      <p className="text-xs font-medium">{formatPrice(releaseDetails.marketStats?.median_price, marketCurrency)}</p>
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Lowest</p>
                      <p className="text-xs font-medium">{formatPrice(releaseDetails.marketStats?.lowest_price, marketCurrency)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {releaseDetails.marketStats?.num_for_sale ?? "n/a"} listed
                    {marketSpreadPercent !== null ? ` • median is ${marketSpreadPercent}% above lowest` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Rating: {typeof releaseDetails.community?.rating?.average === "number"
                      ? `${releaseDetails.community.rating.average.toFixed(2)} (${releaseDetails.community.rating.count ?? 0})`
                      : "n/a"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Have {releaseDetails.community?.have ?? "n/a"} • Want {releaseDetails.community?.want ?? "n/a"}
                  </p>
                  {releaseDetails.marketStats?.blocked_from_sale ? (
                    <span className="mt-2 inline-flex rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300">Sale blocked</span>
                  ) : null}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Price Guide (By Condition)</p>
                  {priceSuggestionRows.length ? (
                    <div className="mt-1 space-y-1.5">
                      {priceSuggestionRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-muted)]">{row.label}</span>
                          <span className="font-medium">{formatPrice(row.value, marketCurrency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">No condition pricing available from Discogs for this release.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3 lg:col-span-2 2xl:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Open Links</p>
                    {releaseLinksLoading ? <span className="text-[10px] text-[var(--color-muted)]">finding stores…</span> : null}
                    {releaseLinksError ? <span className="text-[10px] text-rose-300">{releaseLinksError}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {discogsReleaseUrl ? (
                      <a
                        href={discogsReleaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-surface)]"
                      >
                        Discogs
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {primaryBandcampLink ? (
                      <a
                        href={primaryBandcampLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                      >
                        Best Bandcamp match
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {releaseVideoUrl ? (
                      <a
                        href={releaseVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-surface)]"
                      >
                        Release video
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {fallbackShopLinks.map((link) => (
                      <a
                        key={`${link.provider}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-surface)]"
                      >
                        {link.provider[0].toUpperCase() + link.provider.slice(1)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start gap-1.5 md:items-center md:gap-2">
        <div
          id="digqueue-youtube-player"
          className="h-14 w-24 overflow-hidden rounded-md border border-[var(--color-border-soft)] sm:h-16 sm:w-28 md:h-20 md:w-36"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--color-text)] sm:text-base md:text-lg">
            {current?.track?.title || "Now Playing"}
            {currentCatalogNumber ? <span className="ml-1 text-xs font-medium text-[var(--color-muted)]">({currentCatalogNumber})</span> : null}
            {current?.release ? (
              <a
                className="ml-1 inline-flex align-middle text-[var(--color-muted)] hover:text-[var(--color-text)]"
                href={toDiscogsWebUrl(current?.release?.discogsUrl ?? "", "")}
                target="_blank"
                rel="noreferrer"
                title="Open release on Discogs"
                aria-label="Open release on Discogs"
              >
                <Disc3 className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">{currentArtistLine}</div>
          <div className="truncate text-xs text-[var(--color-muted)]">{releaseMeta}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                liveBpmStatus === "running"
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100"
                  : "border-[var(--color-border)] text-[var(--color-text)]"
              }`}
              aria-live="polite"
            >
              BPM {currentBpmValue}{bpmInputLabel ? ` · ${bpmInputLabel === "Mic input" ? "mic" : "tab"}` : ""}
            </span>
            {liveBpmStatus !== "running" ? <span className="truncate text-[10px]">{currentBpmLabel}</span> : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-5 rounded-md border border-[var(--color-border)] px-1.5 text-[10px]"
              onClick={() => {
                if (liveBpmStatus === "off" || liveBpmStatus === "error") {
                  void startLiveBpmCapture();
                } else {
                  stopLiveBpmCapture();
                }
              }}
              title={liveBpmStatus === "off" || liveBpmStatus === "error" ? "Enable live BPM from shared tab audio" : "Stop live BPM detection"}
              aria-label={liveBpmStatus === "off" || liveBpmStatus === "error" ? "Enable live BPM" : "Stop live BPM"}
            >
              {liveBpmStatus === "off" || liveBpmStatus === "error" ? "BPM" : "Stop"}
            </Button>
          </div>
          <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
            <span className="w-8 text-right text-[11px] text-[var(--color-muted)] sm:w-10">{formatTime(sliderValue)}</span>
            <input
              type="range"
              min={0}
              max={sliderMax}
              value={sliderValue}
              onChange={(event) => {
                const next = Number(event.target.value);
                const itemId = currentRef.current?.id;
                if (itemId) {
                  manualSeekOverrideForIdRef.current = itemId;
                  middlePreviewEndRef.current = null;
                  middlePreviewAdvancedForIdRef.current = null;
                }
                setCurrentTime(next);
                if (playerRef.current) {
                  playerRef.current.seekTo(next, true);
                }
              }}
              className="h-1 w-full accent-[var(--color-accent)]"
              aria-label="Track timeline"
            />
            <span className="w-8 text-[11px] text-[var(--color-muted)] sm:w-10">{formatTime(sliderMax)}</span>
          </div>
        </div>
        <div className="mt-2 flex w-full flex-col gap-2 md:hidden">
          <div className="grid grid-cols-4 gap-2">
            <Button variant="ghost" size="sm" className="h-10 w-full rounded-md border border-[var(--color-border)]" onClick={() => loadPrev()} aria-label="Previous">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-accent)] p-0 text-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0"
              onClick={() => {
                if (!playerRef.current) return;
                if (!current) {
                  void loadNext();
                  return;
                }
                if (playing) playerRef.current.pauseVideo();
                else playerRef.current.playVideo();
              }}
              aria-label="Play Pause"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-10 w-full rounded-md border border-emerald-400/60 bg-emerald-500/28 p-0 text-emerald-50 hover:bg-emerald-500/38"
              onClick={() => void markReviewed()}
              disabled={!current?.track?.id || todoLoading !== null}
              title="Mark current track reviewed and move to next track"
              aria-label="Mark current track reviewed and move to next track"
            >
              {todoLoading === "reviewed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void markEntireReleaseReviewed()}
              disabled={!current?.release?.id || todoLoading !== null}
              className="h-10 w-full rounded-md border border-amber-400/60 bg-amber-500/22 p-0 text-black hover:bg-amber-500/32"
              title="Mark entire release reviewed and skip to next release"
              aria-label="Mark entire release reviewed and skip to next release"
            >
              {todoLoading === "reviewed_release" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer list-none rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] px-3 py-2 text-xs text-[var(--color-muted)]">
              More controls
            </summary>
            <div className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-2">
              <div className="grid grid-cols-4 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={expandedOpen ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => setExpandedOpen((prev) => !prev)}
                  disabled={!current}
                  title={expandedOpen ? "Collapse release details" : "Expand release details"}
                  aria-label={expandedOpen ? "Collapse release details" : "Expand release details"}
                >
                  {expandedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={queueOpen ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => {
                    const next = !queueOpen;
                    setQueueOpen(next);
                    if (next) void fetchQueueItems();
                  }}
                  title="Open queue"
                  aria-label="Open queue"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={current?.track?.saved ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => void toggleSaved()}
                  disabled={!current?.track?.id || todoLoading !== null}
                  aria-label={current?.track?.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                  title={current?.track?.saved ? "Saved track (local only)" : "Save track (local only)"}
                >
                  {todoLoading === "saved" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : current?.track?.saved ? (
                    <HeartOff className="h-3.5 w-3.5" />
                  ) : (
                    <Heart className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={current?.release?.wishlist ? "secondary" : "ghost"}
                  className={`${iconButtonClass} ${
                    current?.release?.wishlist
                      ? "border-amber-500/60 bg-amber-500/15 text-black hover:bg-amber-500/25 hover:text-black"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => void toggleCurrentReleaseWishlist()}
                  disabled={!current?.release?.id || wishlistLoading}
                  title={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                  aria-label={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                >
                  {current?.release?.wishlist ? (
                    <BookmarkCheck className="h-5 w-5 stroke-[2.4]" />
                  ) : (
                    <BookmarkPlus className="h-5 w-5 stroke-[2.4]" />
                  )}
                </Button>
                {current?.youtubeVideoId ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${current.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
                    title="Open on YouTube"
                    aria-label="Open on YouTube"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={playbackMode === "in_order" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-center text-xs"
                  onClick={() => setGlobalPlaybackMode("in_order")}
                  aria-label="Playback mode one by one"
                  title="Play one after another in queue order"
                >
                  <ListOrdered className="mr-1 h-3.5 w-3.5" />
                  1-by-1
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={playbackMode === "shuffle" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-center text-xs"
                  onClick={() => setGlobalPlaybackMode("shuffle")}
                  aria-label="Playback mode shuffle"
                  title="Shuffle through pending queue items"
                >
                  <Shuffle className="mr-1 h-3.5 w-3.5" />
                  Shuffle
                </Button>
              </div>
            </div>
          </details>
        </div>

        <div className="hidden w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex md:w-auto md:overflow-visible md:pb-0">
          <details className="shrink-0 md:hidden">
            <summary className="cursor-pointer list-none rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] px-3 py-1 text-xs text-[var(--color-muted)]">
              More
            </summary>
            <div className="mt-2 w-[min(92vw,22rem)] rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-2">
              <div className="grid grid-cols-4 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={expandedOpen ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => setExpandedOpen((prev) => !prev)}
                  disabled={!current}
                  title={expandedOpen ? "Collapse release details" : "Expand release details"}
                  aria-label={expandedOpen ? "Collapse release details" : "Expand release details"}
                >
                  {expandedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={queueOpen ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => {
                    const next = !queueOpen;
                    setQueueOpen(next);
                    if (next) void fetchQueueItems();
                  }}
                  title="Open queue"
                  aria-label="Open queue"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={current?.track?.saved ? "secondary" : "ghost"}
                  className={iconButtonClass}
                  onClick={() => void toggleSaved()}
                  disabled={!current?.track?.id || todoLoading !== null}
                  aria-label={current?.track?.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                  title={current?.track?.saved ? "Saved track (local only)" : "Save track (local only)"}
                >
                  {todoLoading === "saved" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : current?.track?.saved ? (
                    <HeartOff className="h-3.5 w-3.5" />
                  ) : (
                    <Heart className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={current?.release?.wishlist ? "secondary" : "ghost"}
                  className={`${iconButtonClass} ${
                    current?.release?.wishlist
                      ? "border-amber-500/60 bg-amber-500/15 text-black hover:bg-amber-500/25 hover:text-black"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => void toggleCurrentReleaseWishlist()}
                  disabled={!current?.release?.id || wishlistLoading}
                  title={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                  aria-label={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                >
                  {current?.release?.wishlist ? (
                    <BookmarkCheck className="h-5 w-5 stroke-[2.4]" />
                  ) : (
                    <BookmarkPlus className="h-5 w-5 stroke-[2.4]" />
                  )}
                </Button>
                {current?.youtubeVideoId ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${current.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
                    title="Open on YouTube"
                    aria-label="Open on YouTube"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={playbackMode === "in_order" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-center text-xs"
                  onClick={() => setGlobalPlaybackMode("in_order")}
                  aria-label="Playback mode one by one"
                  title="Play one after another in queue order"
                >
                  <ListOrdered className="mr-1 h-3.5 w-3.5" />
                  1-by-1
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={playbackMode === "shuffle" ? "secondary" : "ghost"}
                  className="h-9 w-full justify-center text-xs"
                  onClick={() => setGlobalPlaybackMode("shuffle")}
                  aria-label="Playback mode shuffle"
                  title="Shuffle through pending queue items"
                >
                  <Shuffle className="mr-1 h-3.5 w-3.5" />
                  Shuffle
                </Button>
              </div>
            </div>
          </details>

          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 shadow-[0_6px_20px_rgba(0,0,0,0.25)] md:hidden">
            <Button variant="ghost" size="sm" className={iconButtonClass} onClick={() => loadPrev()} aria-label="Previous">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] p-0 text-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 sm:h-10 sm:w-10"
              onClick={() => {
                if (!playerRef.current) return;
                if (!current) {
                  void loadNext();
                  return;
                }
                if (playing) playerRef.current.pauseVideo();
                else {
                  if (!ensurePlaybackOwnership()) return;
                  playerRef.current.playVideo();
                }
              }}
              aria-label="Play Pause"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
          </div>

          <div className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 shadow-[0_6px_20px_rgba(0,0,0,0.25)] md:flex">
            <Button variant="ghost" size="sm" className={iconButtonClass} onClick={() => loadPrev()} aria-label="Previous">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] p-0 text-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 sm:h-10 sm:w-10"
              onClick={() => {
                if (!playerRef.current) return;
                if (!current) {
                  void loadNext();
                  return;
                }
                if (playing) playerRef.current.pauseVideo();
                else {
                  if (!ensurePlaybackOwnership()) return;
                  playerRef.current.playVideo();
                }
              }}
              aria-label="Play Pause"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1">
            <span className="group relative inline-flex">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-emerald-400/60 bg-emerald-500/28 p-0 text-emerald-50 hover:bg-emerald-500/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-0 sm:h-10 sm:w-10"
                onClick={() => void markReviewed()}
                disabled={!current?.track?.id || todoLoading !== null}
                title="Mark current track reviewed and move to next track"
                aria-label="Mark current track reviewed and move to next track"
              >
                {todoLoading === "reviewed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <span role="tooltip" className={tooltipClass}>Mark current track reviewed and move to next track</span>
            </span>
            <span className="group relative inline-flex">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 w-9 rounded-full border border-amber-400/60 bg-amber-500/22 p-0 text-black hover:bg-amber-500/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-0 sm:h-10 sm:w-10"
                onClick={() => void markEntireReleaseReviewed()}
                disabled={!current?.release?.id || todoLoading !== null}
                title="Mark entire release reviewed and skip to next release"
                aria-label="Mark entire release reviewed and skip to next release"
              >
                {todoLoading === "reviewed_release" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              <span role="tooltip" className={tooltipClass}>Mark entire release reviewed and skip to next release</span>
            </span>
            <span className="group relative hidden md:inline-flex">
              <Button
                type="button"
                size="sm"
                variant={current?.track?.saved ? "secondary" : "ghost"}
                className={iconButtonClass}
                onClick={() => void toggleSaved()}
                disabled={!current?.track?.id || todoLoading !== null}
                aria-label={current?.track?.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                title={current?.track?.saved ? "Saved track (local only)" : "Save track (local only)"}
              >
                {todoLoading === "saved" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : current?.track?.saved ? (
                  <HeartOff className="h-3.5 w-3.5" />
                ) : (
                  <Heart className="h-3.5 w-3.5" />
                )}
              </Button>
              <span
                role="tooltip"
                className={tooltipClass}
              >
                {todoLoading === "saved"
                  ? "Updating saved track..."
                  : current?.track?.saved
                    ? "Track saved locally. Does not add to your Discogs wantlist."
                  : "Save track locally. Does not add to your Discogs wantlist."}
              </span>
            </span>
            <span className="group relative hidden md:inline-flex">
              <Button
                type="button"
                size="sm"
                variant={current?.release?.wishlist ? "secondary" : "ghost"}
                className={`h-9 w-9 sm:h-10 sm:w-10 ${iconButtonClass} ${
                  current?.release?.wishlist
                    ? "border-amber-500/60 bg-amber-500/15 text-black hover:bg-amber-500/25 hover:text-black"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => void toggleCurrentReleaseWishlist()}
                disabled={!current?.release?.id || wishlistLoading}
                title={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                aria-label={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
              >
                {current?.release?.wishlist ? (
                  <BookmarkCheck className="h-5 w-5 stroke-[2.4]" />
                ) : (
                  <BookmarkPlus className="h-5 w-5 stroke-[2.4]" />
                )}
              </Button>
              <span
                role="tooltip"
                className={tooltipClass}
              >
                {wishlistLoading
                  ? "Updating wishlist..."
                  : current?.release?.wishlist
                    ? "Remove from Discogs wishlist"
                    : "Add to Discogs wishlist"}
              </span>
            </span>
          </div>
        </div>
        {current?.youtubeVideoId ? (
          <span className="group relative hidden shrink-0 md:inline-flex">
            <a
              href={`https://www.youtube.com/watch?v=${current.youtubeVideoId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)] sm:h-9 sm:w-9"
              title="Open on YouTube"
              aria-label="Open on YouTube"
            >
              <Youtube className="h-3.5 w-3.5" />
            </a>
            <span role="tooltip" className={tooltipClass}>Open on YouTube</span>
          </span>
        ) : null}
        {currentYoutubeUrl && isIOS ? (
          <span className="group relative hidden shrink-0 md:inline-flex">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={iconButtonClass}
              onClick={openCurrentInYouTubeApp}
              title="Open in YouTube app for background playback"
              aria-label="Open in YouTube app for background playback"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <span role="tooltip" className={tooltipClass}>
              Open in YouTube app (best for background play)
            </span>
          </span>
        ) : null}
        <div className="hidden shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 md:flex">
          <Button
            type="button"
            variant={playbackMode === "in_order" ? "secondary" : "ghost"}
            size="sm"
            className={`h-8 px-2 text-xs ${playbackMode === "in_order" ? "border border-[var(--color-accent)]" : ""}`}
            onClick={() => setGlobalPlaybackMode("in_order")}
            aria-label="Playback mode one by one"
            title="Play one after another in queue order"
          >
            <ListOrdered className="mr-1 h-3.5 w-3.5" />
            1-by-1
          </Button>
          <Button
            type="button"
            variant={playbackMode === "shuffle" ? "secondary" : "ghost"}
            size="sm"
            className={`h-8 px-2 text-xs ${playbackMode === "shuffle" ? "border border-[var(--color-accent)]" : ""}`}
            onClick={() => setGlobalPlaybackMode("shuffle")}
            aria-label="Playback mode shuffle"
            title="Shuffle through pending queue items"
          >
            <Shuffle className="mr-1 h-3.5 w-3.5" />
            Shuffle
          </Button>
        </div>
        <div className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1 md:flex">
          <span className="group relative inline-flex">
            <Button
              type="button"
              size="sm"
              variant={expandedOpen ? "secondary" : "ghost"}
              className={iconButtonClass}
              onClick={() => setExpandedOpen((prev) => !prev)}
              disabled={!current}
              title={expandedOpen ? "Collapse release details" : "Expand release details"}
              aria-label={expandedOpen ? "Collapse release details" : "Expand release details"}
            >
              {expandedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <span role="tooltip" className={tooltipClass}>
              {expandedOpen ? "Collapse release details" : "Expand release details"}
            </span>
          </span>
          <span className="group relative inline-flex">
            <Button
              type="button"
              size="sm"
              variant={queueOpen ? "secondary" : "ghost"}
              className={iconButtonClass}
              onClick={() => {
                const next = !queueOpen;
                setQueueOpen(next);
                if (next) void fetchQueueItems();
              }}
              title="Open queue"
              aria-label="Open queue"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <span role="tooltip" className={tooltipClass}>Open queue</span>
          </span>
        </div>
      </div>
      {isIOS ? (
        <p className="mx-auto mt-1 max-w-[1400px] text-[11px] text-[var(--color-muted)]">
          iOS limitation: embedded YouTube playback stops when Safari closes. Use the open-in-YouTube button for reliable background playback.
        </p>
      ) : null}
      {actionNotice ? (
        <p className="mx-auto mt-1 max-w-[1400px] text-[11px] text-[var(--color-muted)]">{actionNotice}</p>
      ) : null}
    </div>
  );
}
