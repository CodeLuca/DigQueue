"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  syncQueueScopeClient,
} from "@/lib/client-queue-actions";
import { advanceQueueClient, fetchNextQueueItemClient } from "@/lib/client-queue-next";
import {
  useReleaseReviewedClientAction,
  useReleaseWishlistClientAction,
  useTrackTodoClientAction,
} from "@/lib/use-library-client-actions";
import {
} from "@/lib/client-playback-events";
import {
  PLAYBACK_OWNER_STORAGE_KEY,
} from "@/lib/client-events";
import { buildYouTubeHandoffTargets, isIOSLikeDevice } from "@/lib/playback-mobile";
import {
  libraryReleaseReviewedError,
  libraryRecordWishlistError,
  libraryTrackUpdateError,
  reviewedReleaseEndOfQueueNotice,
} from "@/lib/library-action-notices";
import {
  releaseReviewAdvanceLabel,
  trackReviewAdvanceLabel,
} from "@/lib/library-action-labels";
import { usePlaybackModeState } from "@/lib/playback-mode-client";
import { buildReleaseInspectorView, formatPlaybackTime } from "@/lib/release-inspector-view";
import { useMiniPlayerQueue } from "@/lib/use-mini-player-queue";
import {
  getLatestListeningScopeState,
  subscribeListeningScopeState,
} from "@/lib/listening-scope-client-store";
import { useReleaseInspectorData } from "@/lib/use-release-inspector-data";
import { useClientStoreValue } from "@/lib/use-client-store-value";
import { useMiniPlayerCurrentSync } from "@/lib/use-mini-player-current-sync";
import { useMiniPlayerPlaybackControls } from "@/lib/use-mini-player-playback-controls";
import { useMiniPlayerRemoteControls } from "@/lib/use-mini-player-remote-controls";
import { usePlaybackOwnershipLifecycle } from "@/lib/use-playback-ownership-lifecycle";
import { MiniPlayerAuxControls } from "@/components/mini-player-aux-controls";
import { MiniPlayerControlRail } from "@/components/mini-player-control-rail";
import { MiniPlayerNowPlaying } from "@/components/mini-player-now-playing";
import { MiniPlayerQueueOverlay } from "@/components/mini-player-queue-overlay";
import { ReleaseInspectorPanel } from "@/components/release-inspector-panel";
import type { PlaybackQueueItem } from "@/lib/playback-queue-item";

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

const PLAYBACK_OWNER_TTL_MS = 12000;
const REQUEST_TIMEOUT_MS = 15000;
const BULK_REQUEST_TIMEOUT_MS = 30000;
const BPM_SAMPLE_INTERVAL_MS = 50;
const BPM_ESTIMATE_INTERVAL_MS = 1200;
const BPM_WINDOW_SECONDS = 16;
const BPM_AVG_WINDOW_SIZE = 6;
const BPM_MIN = 70;
const BPM_MAX = 200;

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
  const pendingPlayItemRef = useRef<PlaybackQueueItem | null>(null);
  const currentRef = useRef<PlaybackQueueItem | null>(null);
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
  const lastScopeSyncAtRef = useRef(0);
  const lastAdvanceMutationRef = useRef<{ id: number; action: "played" | "listened"; at: number } | null>(null);
  const lastManualPlayAdvanceAtRef = useRef(0);
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
  const [current, setCurrent] = useState<PlaybackQueueItem | null>(null);
  const [history, setHistory] = useState<PlaybackQueueItem[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [todoLoading, setTodoLoading] = useState<"reviewed" | "reviewed_release" | "saved" | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const { playbackMode, setPlaybackMode } = usePlaybackModeState();
  const listeningScope = useClientStoreValue(
    subscribeListeningScopeState,
    () => getLatestListeningScopeState() ?? { enabled: false, trackIds: [] },
  );
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
    return isIOSLikeDevice({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  }, []);

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

  const syncQueueToListeningScope = useCallback(async (options?: { force?: boolean }) => {
    if (!isListeningStationTab || !listeningScopeEnabledRef.current) return;
    const trackIds = listeningScopeTrackIdsRef.current;
    if (trackIds.length === 0) return;
    const scopeKey = `${trackIds.join(",")}`;
    const now = Date.now();
    if (!options?.force && scopeKey === syncedScopeKeyRef.current) return;
    if (!options?.force && now - lastScopeSyncAtRef.current < 3_000) return;
    syncedScopeKeyRef.current = scopeKey;
    lastScopeSyncAtRef.current = now;
    try {
      await syncQueueScopeClient(
        { enabled: true, trackIds },
        { fetcher: fetchWithTimeout },
      );
    } catch {
      // Scope sync is best-effort; don't block playback controls.
    }
  }, [fetchWithTimeout, isListeningStationTab]);

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

  const {
    closeQueue,
    queueError,
    queueItems: queueItemsState,
    queueLoading,
    queueOpen,
    removeQueueItem,
    refreshQueueIfOpen,
    setQueueItems: setQueueItemsState,
    toggleQueue,
  } = useMiniPlayerQueue<PlaybackQueueItem>({
    fetcher: fetchWithTimeout,
    isListeningStationTab,
    getListeningScopeEnabled: () => listeningScopeEnabledRef.current,
    getListeningScopeTrackIds: () => listeningScopeTrackIdsRef.current,
    onQueueActivity: () => {
      if (isListeningStationTab) {
        return syncQueueToListeningScope()
          .then(() => undefined)
          .catch(() => undefined);
      }
      return undefined;
    },
  });

  const updateTrackTodo = useTrackTodoClientAction({
    fetcher: fetchWithTimeout,
    unauthorizedMessage: "Session expired. Please log in again.",
  });

  const updateReleaseWishlist = useReleaseWishlistClientAction({
    fetcher: fetchWithTimeout,
  });

  const markReleaseReviewed = useReleaseReviewedClientAction({
    fetcher: (input, init) => fetchWithTimeout(input, init, BULK_REQUEST_TIMEOUT_MS),
  });

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
      const activeCurrentId = currentId ?? currentRef.current?.id;
      const hasMutationTarget = Boolean(action && activeCurrentId && activeCurrentId > 0);
      let item: PlaybackQueueItem | null = null;
      if (hasMutationTarget) {
        const now = Date.now();
        const previous = lastAdvanceMutationRef.current;
        const isDuplicateAdvance =
          previous &&
          previous.id === activeCurrentId &&
          previous.action === action &&
          now - previous.at < 1_200;
        if (!isDuplicateAdvance) {
          const advanceAction = action as "played" | "listened";
          lastAdvanceMutationRef.current = { id: activeCurrentId as number, action: advanceAction, at: now };
          item = await advanceQueueClient<PlaybackQueueItem>({
            currentId: activeCurrentId as number,
            action: advanceAction,
            mode: activeMode,
            order: activeOrder,
          });
        }
      }
      if (!item) {
        item = await fetchNextQueueItemClient<PlaybackQueueItem>({
          mode: activeMode,
          order: activeOrder,
        });
      }
      if (!item && isListeningStationTab && listeningScopeEnabledRef.current) {
        await syncQueueToListeningScope({ force: true });
        item = await fetchNextQueueItemClient<PlaybackQueueItem>({ mode: activeMode, order: activeOrder });
      }
      if (item === null) {
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
        await updateTrackTodo({ trackIds: [trackId], field: "listened", mode: "set", value: true });
        await loadNext("played");
        return;
      }
      await loadNext("played");
    } catch (error) {
      setActionNotice(libraryTrackUpdateError(error));
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
      await markReleaseReviewed(releaseId);
      // Skip any queued items still tied to the same release so this action
      // consistently lands on the next release in queue.
      let advanced = await loadNext("played");
      let attempts = 0;
      while (advanced && currentRef.current?.release?.id === releaseId && attempts < 8) {
        attempts += 1;
        advanced = await loadNext("played");
      }
    if (!advanced || currentRef.current?.release?.id === releaseId) {
        setActionNotice(reviewedReleaseEndOfQueueNotice());
      }
    } catch (error) {
      setActionNotice(libraryReleaseReviewedError(error));
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
      await updateTrackTodo({ trackIds: [trackId], field: "saved", mode: "toggle" });
    } catch (error) {
      setActionNotice(libraryTrackUpdateError(error));
    } finally {
      toggleSavedInFlightRef.current = false;
      setTodoLoading(null);
    }
  }, [current?.track?.id, updateTrackTodo]);

  const toggleCurrentReleaseWishlist = useCallback(async () => {
    if (toggleWishlistInFlightRef.current) return;
    const releaseId = current?.release?.id;
    if (!releaseId) return;
    toggleWishlistInFlightRef.current = true;
    const currentWishlist = Boolean(current?.release?.wishlist);
    setWishlistLoading(true);
    try {
      await updateReleaseWishlist({ releaseId, mode: "set", value: !currentWishlist });
    } catch (error) {
      setActionNotice(libraryRecordWishlistError(error));
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

  const loadSpecific = useCallback(async (item: PlaybackQueueItem) => {
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
        const now = Date.now();
        if (now - lastManualPlayAdvanceAtRef.current > 1_200) {
          lastManualPlayAdvanceAtRef.current = now;
          void advanceQueueClient<PlaybackQueueItem>({
            currentId: previousCurrent.id,
            action: "played",
            mode: "hybrid",
            order: playbackMode,
          }).catch(() => null);
        }
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
  }, [ensurePlaybackOwnership, playbackMode, ready, setQueueItemsState]);

  const { next: nextPlayback, playItem: playQueueEventItem, playPause, prev: prevPlayback } =
    useMiniPlayerPlaybackControls<PlaybackQueueItem>({
      current,
      ready,
      playing,
      ensurePlaybackOwnership,
      pausePlayback: () => {
        playerRef.current?.pauseVideo();
      },
      resumePlayback: () => {
        playerRef.current?.playVideo();
      },
      loadNext,
      loadPrev,
      loadSpecific,
      markReviewed,
    });

  useMiniPlayerCurrentSync({
    current,
    currentRef,
    playing,
    setCurrent,
  });

  useEffect(() => {
    if (!isListeningStationTab) {
      listeningScopeEnabledRef.current = false;
      listeningScopeTrackIdsRef.current = [];
    }
  }, [isListeningStationTab]);

  useEffect(() => {
    listeningScopeTrackIdsRef.current = listeningScope.trackIds;
    listeningScopeEnabledRef.current = listeningScope.enabled;
    if (!isListeningStationTab) return;
    void syncQueueToListeningScope()
      .then(() => {
        return refreshQueueIfOpen();
      })
      .catch(() => null);
  }, [isListeningStationTab, listeningScope, refreshQueueIfOpen, syncQueueToListeningScope]);

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

  usePlaybackOwnershipLifecycle({
    isIOS,
    playing,
    ready,
    playerRef,
    currentRef,
    tabIdRef,
    wasPlayingBeforeHiddenRef,
    maybeAutoAdvanceAtTrackEnd,
    readPlaybackOwner,
    writePlaybackOwner,
    clearPlaybackOwnerIfOwned,
    ensurePlaybackOwnership,
    onOwnershipTaken: () => {
      setPlaying(false);
      setActionNotice("Playback moved to another tab.");
    },
  });
  useMiniPlayerRemoteControls({
    current,
    playing,
    playerRef,
    ensurePlaybackOwnership: () => ensurePlaybackOwnership(),
    playPause,
    nextPlayback,
    prevPlayback,
  });

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
  const {
    releaseDetails,
    releaseLinks,
  } = useReleaseInspectorData(currentReleaseId, expandedOpen);

  const releaseInspector = useMemo(
    () => buildReleaseInspectorView({ current, releaseDetails, releaseLinks }),
    [current, releaseDetails, releaseLinks],
  );

  const sliderMax = Math.max(1, Math.floor(duration || 0));
  const sliderValue = Math.min(sliderMax, Math.max(0, Math.floor(currentTime || 0)));
  const openCurrentInYouTubeApp = useCallback(() => {
    const targets = buildYouTubeHandoffTargets(current?.youtubeVideoId || "", isIOS);
    if (!targets) return;
    if (!targets.needsDeepLinkFallback) {
      window.open(targets.primaryUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // iOS cannot keep iframe playback alive after Safari closes, so hand off to YouTube.
    window.location.href = targets.primaryUrl;
    window.setTimeout(() => {
      if (!targets.fallbackUrl) return;
      window.open(targets.fallbackUrl, "_blank", "noopener,noreferrer");
    }, 700);
  }, [current?.youtubeVideoId, isIOS]);

  const playQueueItemNow = useCallback((item: PlaybackQueueItem) => {
    playQueueEventItem(item);
    closeQueue();
  }, [closeQueue, playQueueEventItem]);
  const togglePlayback = useCallback(() => {
    playPause();
  }, [playPause]);

  const iconButtonClass =
    "h-8 w-8 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] p-0 text-[var(--color-text)] hover:bg-[var(--color-surface2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 sm:h-9 sm:w-9";
  const tooltipClass =
    "pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_92%,black_8%)] px-2 py-1 text-[11px] text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";
  const currentTrackSaved = Boolean(current?.track?.saved);
  const currentReleaseWishlisted = Boolean(current?.release?.wishlist);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border-soft)] bg-[color-mix(in_oklab,var(--color-surface)_90%,black_10%)] px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:px-4">
      <MiniPlayerQueueOverlay
        open={queueOpen}
        items={queueItemsState}
        loading={queueLoading}
        error={queueError}
        onClose={closeQueue}
        onPlayNow={playQueueItemNow}
        onRemove={(itemId) => void removeQueueItem(itemId)}
      />
      {expandedOpen ? (
        <ReleaseInspectorPanel
          current={current}
          currentTrackTitle={current?.track?.title}
          className="mx-auto mb-2 max-w-[1400px]"
        />
      ) : null}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start gap-1.5 md:items-center md:gap-2">
        <div
          id="digqueue-youtube-player"
          className="h-14 w-24 overflow-hidden rounded-md border border-[var(--color-border-soft)] sm:h-16 sm:w-28 md:h-20 md:w-36"
        />
        <MiniPlayerNowPlaying
          currentTrackTitle={current?.track?.title}
          currentCatalogNumber={releaseInspector.currentCatalogNumber}
          currentDiscogsUrl={current?.release?.discogsUrl ?? null}
          currentArtistLine={releaseInspector.currentArtistLine}
          releaseMeta={releaseMeta}
          liveBpmStatus={liveBpmStatus}
          currentBpmValue={currentBpmValue}
          bpmInputLabel={bpmInputLabel}
          currentBpmLabel={currentBpmLabel}
          onToggleLiveBpm={() => {
            if (liveBpmStatus === "off" || liveBpmStatus === "error") {
              void startLiveBpmCapture();
            } else {
              stopLiveBpmCapture();
            }
          }}
          sliderValue={sliderValue}
          sliderMax={sliderMax}
          formatPlaybackTime={formatPlaybackTime}
          onSeek={(next) => {
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
        />
        <div className="mt-2 flex w-full flex-col gap-2 md:hidden">
          <MiniPlayerControlRail
            mode="mobile"
            currentLoaded={Boolean(current)}
            playing={playing}
            currentTrackId={current?.track?.id}
            currentReleaseId={current?.release?.id}
            todoLoading={todoLoading}
            iconButtonClass={iconButtonClass}
            tooltipClass={tooltipClass}
            onPrevious={loadPrev}
            onPlayPause={togglePlayback}
            onMarkReviewed={() => void markReviewed()}
            onMarkReleaseReviewed={() => void markEntireReleaseReviewed()}
            trackReviewLabel={trackReviewAdvanceLabel("current track")}
            releaseReviewLabel={releaseReviewAdvanceLabel()}
          />
          <details>
            <summary className="cursor-pointer list-none rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] px-3 py-2 text-xs text-[var(--color-muted)]">
              More controls
            </summary>
            <div className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-2">
              <MiniPlayerAuxControls
                mode="compact"
                currentLoaded={Boolean(current)}
                currentTrackSaved={currentTrackSaved}
                currentReleaseWishlisted={currentReleaseWishlisted}
                currentTrackId={current?.track?.id}
                currentReleaseId={current?.release?.id}
                currentYoutubeVideoId={current?.youtubeVideoId}
                currentYoutubeAppUrl={releaseInspector.currentYoutubeUrl}
                isIOS={isIOS}
                todoLoading={todoLoading}
                wishlistLoading={wishlistLoading}
                expandedOpen={expandedOpen}
                queueOpen={queueOpen}
                playbackMode={playbackMode}
                iconButtonClass={iconButtonClass}
                onToggleSaved={() => void toggleSaved()}
                onToggleWishlist={() => void toggleCurrentReleaseWishlist()}
                onOpenYouTubeApp={openCurrentInYouTubeApp}
                onSetPlaybackMode={setPlaybackMode}
                onToggleExpanded={() => setExpandedOpen((prev) => !prev)}
                onToggleQueue={toggleQueue}
              />
            </div>
          </details>
        </div>

        <div className="hidden w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex md:w-auto md:overflow-visible md:pb-0">
          <MiniPlayerControlRail
            mode="desktop"
            currentLoaded={Boolean(current)}
            playing={playing}
            currentTrackId={current?.track?.id}
            currentReleaseId={current?.release?.id}
            todoLoading={todoLoading}
            iconButtonClass={iconButtonClass}
            tooltipClass={tooltipClass}
            onPrevious={loadPrev}
            onPlayPause={togglePlayback}
            onMarkReviewed={() => void markReviewed()}
            onMarkReleaseReviewed={() => void markEntireReleaseReviewed()}
            trackReviewLabel={trackReviewAdvanceLabel("current track")}
            releaseReviewLabel={releaseReviewAdvanceLabel()}
          />
         </div>
        <MiniPlayerAuxControls
          mode="desktop"
          currentLoaded={Boolean(current)}
          currentTrackSaved={currentTrackSaved}
          currentReleaseWishlisted={currentReleaseWishlisted}
          currentTrackId={current?.track?.id}
          currentReleaseId={current?.release?.id}
          currentYoutubeVideoId={current?.youtubeVideoId}
          currentYoutubeAppUrl={releaseInspector.currentYoutubeUrl}
          isIOS={isIOS}
          todoLoading={todoLoading}
          wishlistLoading={wishlistLoading}
          expandedOpen={expandedOpen}
          queueOpen={queueOpen}
          playbackMode={playbackMode}
          iconButtonClass={iconButtonClass}
          tooltipClass={tooltipClass}
          onToggleSaved={() => void toggleSaved()}
          onToggleWishlist={() => void toggleCurrentReleaseWishlist()}
          onOpenYouTubeApp={openCurrentInYouTubeApp}
          onSetPlaybackMode={setPlaybackMode}
          onToggleExpanded={() => setExpandedOpen((prev) => !prev)}
          onToggleQueue={toggleQueue}
        />
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
