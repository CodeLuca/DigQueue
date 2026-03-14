"use client";

import { useEffect } from "react";
import { PLAYBACK_OWNER_STORAGE_KEY } from "@/lib/client-events";

type OwnershipState = {
  tabId: string;
  updatedAt: number;
};

type PlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
};

export function usePlaybackOwnershipLifecycle<TPlayer extends PlayerLike>(options: {
  isIOS: boolean;
  playing: boolean;
  ready: boolean;
  playerRef: React.RefObject<TPlayer | null>;
  currentRef: React.RefObject<unknown>;
  tabIdRef: React.RefObject<string>;
  wasPlayingBeforeHiddenRef: React.RefObject<boolean>;
  maybeAutoAdvanceAtTrackEnd: () => void;
  readPlaybackOwner: () => OwnershipState | null;
  writePlaybackOwner: (state: OwnershipState) => void;
  clearPlaybackOwnerIfOwned: () => void;
  ensurePlaybackOwnership: (showNotice?: boolean) => boolean;
  onOwnershipTaken: () => void;
}) {
  const {
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
    onOwnershipTaken,
  } = options;

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
  }, [
    clearPlaybackOwnerIfOwned,
    currentRef,
    ensurePlaybackOwnership,
    isIOS,
    maybeAutoAdvanceAtTrackEnd,
    playerRef,
    playing,
    ready,
    wasPlayingBeforeHiddenRef,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!playing) return;
      const owner = readPlaybackOwner();
      if (owner?.tabId === tabIdRef.current) {
        writePlaybackOwner({ tabId: tabIdRef.current, updatedAt: Date.now() });
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [playing, readPlaybackOwner, tabIdRef, writePlaybackOwner]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PLAYBACK_OWNER_STORAGE_KEY) return;
      if (!playerRef.current) return;
      if (!playing) return;
      const owner = readPlaybackOwner();
      if (owner && owner.tabId !== tabIdRef.current) {
        playerRef.current.pauseVideo();
        onOwnershipTaken();
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
  }, [
    clearPlaybackOwnerIfOwned,
    onOwnershipTaken,
    playerRef,
    playing,
    readPlaybackOwner,
    tabIdRef,
  ]);
}
