"use client";

import { Button } from "@/components/ui/button";
import { responsiveActionButtonLayout } from "@/components/responsive-action-button-layout";
import { dispatchPlaybackNextEvent } from "@/lib/client-playback-events";

export function QueuePlayControls() {
  return (
    <div className="grid gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        type="button"
        size="sm"
        className={responsiveActionButtonLayout({})}
        title="Start playback in the mini-player from the next queued item"
        onClick={dispatchPlaybackNextEvent}
      >
        Play Queue
      </Button>
      <p className="text-xs text-[var(--color-muted)] sm:self-center">
        Uses the bottom mini-player and starts/advances queue playback.
      </p>
    </div>
  );
}
