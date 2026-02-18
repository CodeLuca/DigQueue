"use client";

import { useEffect } from "react";

export function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (event.key === " ") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("digqueue:playpause"));
      }
      if (event.key.toLowerCase() === "n") {
        window.dispatchEvent(new CustomEvent("digqueue:next"));
      }
      if (event.key.toLowerCase() === "b") {
        window.dispatchEvent(new CustomEvent("digqueue:prev"));
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
