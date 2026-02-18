"use client";

import { Button } from "@/components/ui/button";

export function QueuePlayControls() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        title="Start playback in the mini-player from the next queued item"
        onClick={() => window.dispatchEvent(new CustomEvent("digqueue:next"))}
      >
        Play Queue
      </Button>
      <p className="self-center text-xs text-[var(--color-muted)]">
        Uses the bottom mini-player and starts/advances queue playback.
      </p>
    </div>
  );
}
