"use client";

import { useCallback, useEffect, useState } from "react";
import { dispatchPlaybackModeEvent, subscribePlaybackMode } from "@/lib/client-playback-events";
import { PLAYBACK_MODE_STORAGE_KEY } from "@/lib/client-events";

export type PlaybackMode = "in_order" | "shuffle";

export function readPlaybackModeFromStorage(): PlaybackMode {
  if (typeof window === "undefined") return "in_order";
  const stored = window.localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY);
  return stored === "shuffle" || stored === "in_order" ? stored : "in_order";
}

export function writePlaybackModeToStorage(mode: PlaybackMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, mode);
}

export function setGlobalPlaybackMode(mode: PlaybackMode) {
  writePlaybackModeToStorage(mode);
  dispatchPlaybackModeEvent(mode);
}

export function usePlaybackModeState() {
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => readPlaybackModeFromStorage());

  useEffect(() => {
    return subscribePlaybackMode(({ mode }) => {
      if (mode === "shuffle" || mode === "in_order") {
        setPlaybackMode(mode);
      }
    });
  }, []);

  const updatePlaybackMode = useCallback((nextMode: PlaybackMode) => {
    setPlaybackMode(nextMode);
    setGlobalPlaybackMode(nextMode);
  }, []);

  return {
    playbackMode,
    setPlaybackMode: updatePlaybackMode,
  };
}
