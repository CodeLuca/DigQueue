"use client";

import { useEffect } from "react";
import {
  dispatchPlaybackNextEvent,
  dispatchPlaybackPlayPauseEvent,
  dispatchPlaybackPrevEvent,
} from "@/lib/client-playback-events";

export function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === " ") {
        event.preventDefault();
        dispatchPlaybackPlayPauseEvent();
      }
      if (event.key.toLowerCase() === "n") {
        dispatchPlaybackNextEvent();
      }
      if (event.key.toLowerCase() === "b") {
        dispatchPlaybackPrevEvent();
      }
      if (event.key.toLowerCase() === "l") {
        const input = document.getElementById("label-input") as HTMLInputElement | null;
        input?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}
