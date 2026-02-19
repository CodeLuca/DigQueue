"use client";

import { Button } from "@/components/ui/button";

export function QueuePlayControls() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button
        type="button"
        size="sm"
        title="Start playback in the mini-player from the next queued item"
        onClick={() => window.dispatchEvent(new CustomEvent("digqueue:next"))}
      >
        Play Queue
      </Button>
      <p className="text-xs text-[var(--color-muted)] sm:self-center">
        Uses the bottom mini-player and starts/advances queue playback.
      </p>
    </div>
  );
}
