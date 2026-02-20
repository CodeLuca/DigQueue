"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Disc3,
  ExternalLink,
  Heart,
  HeartOff,
  ListOrdered,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
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
  }
}

type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
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
  track?: { id: number; title: string; artistsText?: string | null; saved?: boolean; listened?: boolean } | null;
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
  tracklist?: Array<unknown>;
  videos?: Array<unknown>;
};

const TRACK_TODO_UPDATED_EVENT = "digqueue:track-todo-updated";
const RELEASE_WISHLIST_UPDATED_EVENT = "digqueue:release-wishlist-updated";
const LISTENING_SCOPE_EVENT = "digqueue:listening-scope";
const PLAYBACK_MODE_EVENT = "digqueue:playback-mode";
const PLAYBACK_MODE_STORAGE_KEY = "digqueue:playback-mode";
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

type ListeningScopeDetail = {
  enabled?: boolean;
  trackIds?: number[];
  activeLabelId?: number | null;
};

export function MiniPlayer() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  const isListeningStationTab = activeTab === "step-2" || activeTab === "step-3";
  const isLibraryTab = searchParams.get("tab") === "wishlist";
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingPlayItemRef = useRef<QueueApiItem | null>(null);
  const currentRef = useRef<QueueApiItem | null>(null);
  const handlingEndedForIdRef = useRef<number | null>(null);
  const middlePreviewPreparedForIdRef = useRef<number | null>(null);
  const middlePreviewEndRef = useRef<number | null>(null);
  const middlePreviewAdvancedForIdRef = useRef<number | null>(null);
  const manualSeekOverrideForIdRef = useRef<number | null>(null);
  const middlePreviewSeekPendingForIdRef = useRef<number | null>(null);
  const listeningScopeTrackIdsRef = useRef<number[]>([]);
  const listeningScopeEnabledRef = useRef(false);
  const releaseDetailsCacheRef = useRef(new Map<number, ReleaseDetailsApiResponse>());
  const [current, setCurrent] = useState<QueueApiItem | null>(null);
  const [history, setHistory] = useState<QueueApiItem[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [todoLoading, setTodoLoading] = useState<"reviewed" | "saved" | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItemsState, setQueueItemsState] = useState<QueueApiItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [releaseDetails, setReleaseDetails] = useState<ReleaseDetailsApiResponse | null>(null);
  const [releaseDetailsLoading, setReleaseDetailsLoading] = useState(false);
  const [releaseDetailsError, setReleaseDetailsError] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => {
    if (typeof window === "undefined") return "in_order";
    const stored = window.localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY);
    return stored === "shuffle" ? "shuffle" : "in_order";
  });
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }, []);

  const syncQueueToListeningScope = useCallback(async () => {
    if (!isListeningStationTab || !listeningScopeEnabledRef.current) return;
    const trackIds = listeningScopeTrackIdsRef.current;
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

  const fetchQueueItems = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
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
    const response = await fetch("/api/tracks/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as TodoApiResponse | null;
    if (!response.ok || !body?.ok) {
      throw new Error(body?.error || "Unable to update track.");
    }
    return body;
  }, []);

  const updateReleaseWishlist = useCallback(async (payload: { releaseId: number; mode?: "toggle" | "set"; value?: boolean }) => {
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
  }, []);

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

  const loadNext = useCallback(async (action: "played" | "listened" | null = null, currentId?: number) => {
    const activeMode = "hybrid";
    const activeOrder = playbackMode;
    await syncQueueToListeningScope();
    const activeCurrentId = currentId ?? currentRef.current?.id;
    const response = action && activeCurrentId
      ? await fetch("/api/queue/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentId: activeCurrentId, action, mode: activeMode, order: activeOrder }),
        })
      : await fetch(`/api/queue/next?mode=${activeMode}&order=${activeOrder}`);
    if (!response.ok) return false;
    let item = (await response.json()) as QueueApiItem | null;
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
    if (previousCurrent) {
      setHistory((prev) => [previousCurrent, ...prev].slice(0, 50));
    }
    setCurrent(item);
    if (playerRef.current) {
      playerRef.current.loadVideoById(item.youtubeVideoId);
      setPlaying(true);
    }
    return true;
  }, [playbackMode, syncQueueToListeningScope]);

  const markReviewed = useCallback(async () => {
    const trackId = current?.track?.id ?? null;
    setTodoLoading("reviewed");
    try {
      const ok = await loadNext(trackId ? "listened" : "played");
      if (ok && trackId) {
        window.dispatchEvent(
          new CustomEvent(TRACK_TODO_UPDATED_EVENT, {
            detail: { trackId, field: "listened", value: true },
          }),
        );
      }
    } finally {
      setTodoLoading(null);
    }
  }, [current?.track?.id, loadNext]);

  const toggleSaved = useCallback(async () => {
    if (!current?.track?.id) return;
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
    } finally {
      setTodoLoading(null);
    }
  }, [current?.track?.id, playing, updateTrackTodo]);

  const toggleCurrentReleaseWishlist = useCallback(async () => {
    const releaseId = current?.release?.id;
    if (!releaseId) return;
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
    } finally {
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

    if (switchingToDifferentItem) {
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
    // If user explicitly picks an item from Up Next, drop it from pending immediately.
    void fetch(`/api/queue/item/${item.id}`, { method: "DELETE" }).catch(() => null);
    setQueueItemsState((prev) => prev.filter((entry) => entry.id !== item.id));
    setCurrent(item);
    playerRef.current.loadVideoById(item.youtubeVideoId);
    setPlaying(true);
  }, [playbackMode, ready]);

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
      playerRef.current = new window.YT.Player("digqueue-youtube-player", {
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            const pendingItem = pendingPlayItemRef.current;
            if (pendingItem) {
              pendingPlayItemRef.current = null;
              setCurrent(pendingItem);
              playerRef.current?.loadVideoById(pendingItem.youtubeVideoId);
              setPlaying(true);
              return;
            }
            void loadNext();
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              const finishedId = currentRef.current?.id;
              if (!finishedId || handlingEndedForIdRef.current === finishedId) return;
              if (manualSeekOverrideForIdRef.current === finishedId) return;
              handlingEndedForIdRef.current = finishedId;
              void loadNext("played", finishedId);
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
            }
          },
        },
      });
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
    };
  }, [loadNext]);

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
    }, 200);
    return () => window.clearInterval(interval);
  }, [loadNext, ready]);

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
  }, [current, loadNext, loadPrev, loadSpecific, markReviewed, playing, ready]);

  const releaseMeta = useMemo(() => {
    if (!current) return "Queue is empty";
    return [current.label?.name?.trim(), current.release?.title?.trim()].filter(Boolean).join(" • ");
  }, [current]);

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
    if (!current?.release?.id) return null;
    return toDiscogsWebUrl(current.release.discogsUrl ?? "", `/release/${current.release.id}`);
  }, [current?.release?.discogsUrl, current?.release?.id]);

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
    "h-9 w-9 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] p-0 text-[var(--color-text)] hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0";
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
                        <img
                          src={item.release.thumbUrl}
                          alt={`${item.release.title ?? item.track?.title ?? "Queue item"} artwork`}
                          className="h-9 w-9 shrink-0 rounded border border-[var(--color-border)] object-cover"
                          loading="lazy"
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
        <div className="mx-auto mb-2 max-w-[1400px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
          {releaseDetailsLoading ? <p className="text-xs text-[var(--color-muted)]">Loading Discogs details…</p> : null}
          {releaseDetailsError ? <p className="text-xs text-rose-300">{releaseDetailsError}</p> : null}
          {!releaseDetailsLoading && !releaseDetailsError ? (
            <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
              <div className="rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-2">
                {expandedArtworkUrl ? (
                  <img
                    src={expandedArtworkUrl}
                    alt={`${current?.release?.title || releaseDetails?.title || "Release"} artwork`}
                    className="aspect-square w-full rounded-md border border-[var(--color-border)] object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]" />
                )}
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Current Track</p>
                  <p className="line-clamp-2 text-sm font-medium">{current?.track?.title || "Unknown track"}</p>
                  <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{currentArtist || "Unknown artist"}</p>
                  <p className="line-clamp-2 text-xs text-[var(--color-muted)]">Release: {current?.release?.title || releaseDetails?.title || "Unknown release"}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Record Info</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {releaseDetails?.year || "n/a"} • {releaseDetails?.country || "n/a"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{currentLabel || "Label unknown"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{currentFormats || "Format unknown"}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-[var(--color-muted)]">{currentGenreStyles || "No genre/style tags"}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Discogs Market</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Median price: {formatPrice(releaseDetails?.marketStats?.median_price, releaseDetails?.marketStats?.currency)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Lowest listed: {formatPrice(releaseDetails?.marketStats?.lowest_price, releaseDetails?.marketStats?.currency)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">For sale: {releaseDetails?.marketStats?.num_for_sale ?? "n/a"}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Rating: {typeof releaseDetails?.community?.rating?.average === "number"
                      ? `${releaseDetails.community.rating.average.toFixed(2)} (${releaseDetails.community.rating.count ?? 0})`
                      : "n/a"}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Community</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Have: {releaseDetails?.community?.have ?? "n/a"}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Want: {releaseDetails?.community?.want ?? "n/a"}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Tracklist: {releaseDetails?.tracklist?.length ?? "n/a"} tracks</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Videos: {releaseDetails?.videos?.length ?? "n/a"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {releaseDetails?.marketStats?.blocked_from_sale ? (
                      <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300">Sale blocked</span>
                    ) : null}
                    {discogsReleaseUrl ? (
                      <a
                        href={discogsReleaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                      >
                        Open on Discogs
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start gap-2 md:items-center">
        <div
          id="digqueue-youtube-player"
          className="h-16 w-28 overflow-hidden rounded-md border border-[var(--color-border-soft)] md:h-20 md:w-36"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--color-text)] sm:text-base md:text-lg">
            {current?.track?.title || "Now Playing"}
            {currentCatalogNumber ? <span className="ml-1 text-xs font-medium text-[var(--color-muted)]">({currentCatalogNumber})</span> : null}
            {current?.release ? (
              <a
                className="ml-1 inline-flex align-middle text-[var(--color-muted)] hover:text-[var(--color-text)]"
                href={toDiscogsWebUrl(current?.release?.discogsUrl ?? "", current?.release?.id ? `/release/${current.release.id}` : "")}
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
        <div className="flex w-full flex-wrap items-center gap-2 pb-1 md:w-auto md:pb-0">
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1">
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
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1">
            {!isLibraryTab ? (
              <span className="group relative inline-flex">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-0"
                  onClick={() => void markReviewed()}
                  disabled={!current?.track?.id || todoLoading !== null}
                  title="Mark reviewed and move to the next track"
                  aria-label="Mark reviewed and move to next track"
                >
                  {todoLoading === "reviewed" ? "..." : "Mark Reviewed"}
                </Button>
                <span role="tooltip" className={tooltipClass}>Mark reviewed and move to next</span>
              </span>
            ) : null}
            <span className="group relative inline-flex">
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
                {todoLoading === "saved" ? "..." : current?.track?.saved ? (
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
            <span className="group relative inline-flex">
              <Button
                type="button"
                size="sm"
                variant={current?.release?.wishlist ? "secondary" : "ghost"}
                className={`${iconButtonClass} ${
                  current?.release?.wishlist
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:text-amber-100"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
                onClick={() => void toggleCurrentReleaseWishlist()}
                disabled={!current?.release?.id || wishlistLoading}
                title={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
                aria-label={current?.release?.wishlist ? "Remove from Discogs wishlist" : "Add to Discogs wishlist"}
              >
                {current?.release?.wishlist ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
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
          <span className="group relative inline-flex shrink-0">
            <a
              href={`https://www.youtube.com/watch?v=${current.youtubeVideoId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
              title="Open on YouTube"
              aria-label="Open on YouTube"
            >
              <Youtube className="h-3.5 w-3.5" />
            </a>
            <span role="tooltip" className={tooltipClass}>Open on YouTube</span>
          </span>
        ) : null}
        {currentYoutubeUrl ? (
          <span className="group relative inline-flex shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={iconButtonClass}
              onClick={openCurrentInYouTubeApp}
              title={isIOS ? "Open in YouTube app for background playback" : "Open in YouTube"}
              aria-label={isIOS ? "Open in YouTube app for background playback" : "Open in YouTube"}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <span role="tooltip" className={tooltipClass}>
              {isIOS ? "Open in YouTube app (best for background play)" : "Open video in YouTube"}
            </span>
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1">
          <span className="group relative inline-flex">
            <Button
              type="button"
              variant={playbackMode === "in_order" ? "secondary" : "ghost"}
              size="sm"
              className={iconButtonClass}
              onClick={() => setGlobalPlaybackMode("in_order")}
              aria-label="Play in order"
              title="Play one after another in queue order"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <span role="tooltip" className={tooltipClass}>Play in order</span>
          </span>
          <span className="group relative inline-flex">
            <Button
              type="button"
              variant={playbackMode === "shuffle" ? "secondary" : "ghost"}
              size="sm"
              className={iconButtonClass}
              onClick={() => setGlobalPlaybackMode("shuffle")}
              aria-label="Play shuffled"
              title="Shuffle through pending queue items"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </Button>
            <span role="tooltip" className={tooltipClass}>Shuffle playback</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
          <Button variant="ghost" size="sm" className={iconButtonClass} onClick={() => loadPrev()} aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-10 w-10 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] p-0 text-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0"
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
          <Button variant="ghost" size="sm" className={iconButtonClass} onClick={() => void loadNext("played")} aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {isIOS ? (
        <p className="mx-auto mt-1 max-w-[1400px] text-[11px] text-[var(--color-muted)]">
          iOS limitation: embedded YouTube playback stops when Safari closes. Use the open-in-YouTube button for reliable background playback.
        </p>
      ) : null}
    </div>
  );
}
