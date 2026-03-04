"use client";

import { useEffect } from "react";
import { PLAYBACK_NEXT_EVENT, PLAYBACK_PLAYPAUSE_EVENT, PLAYBACK_PREV_EVENT } from "@/lib/client-events";

export function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === " ") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(PLAYBACK_PLAYPAUSE_EVENT));
      }
      if (event.key.toLowerCase() === "n") {
        window.dispatchEvent(new CustomEvent(PLAYBACK_NEXT_EVENT));
      }
      if (event.key.toLowerCase() === "b") {
        window.dispatchEvent(new CustomEvent(PLAYBACK_PREV_EVENT));
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
