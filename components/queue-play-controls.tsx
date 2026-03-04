"use client";

import { Button } from "@/components/ui/button";
import { PLAYBACK_NEXT_EVENT } from "@/lib/client-events";

export function QueuePlayControls() {
  return (
    <div className="grid gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        type="button"
        size="sm"
        className="w-full justify-center sm:w-auto sm:justify-start"
        title="Start playback in the mini-player from the next queued item"
        onClick={() => window.dispatchEvent(new CustomEvent(PLAYBACK_NEXT_EVENT))}
      >
        Play Queue
      </Button>
      <p className="text-xs text-[var(--color-muted)] sm:self-center">
        Uses the bottom mini-player and starts/advances queue playback.
      </p>
    </div>
  );
}
