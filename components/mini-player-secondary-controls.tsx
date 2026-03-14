"use client";

import { ChevronDown, ChevronUp, ListOrdered, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MiniPlayerIconButtonControl,
} from "@/components/mini-player-utility-controls";

export function MiniPlayerPlaybackModeControls({
  playbackMode,
  onSetPlaybackMode,
  className,
  buttonClassName,
}: {
  playbackMode: "in_order" | "shuffle";
  onSetPlaybackMode: (mode: "in_order" | "shuffle") => void;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <div className={className}>
      <Button
        type="button"
        variant={playbackMode === "in_order" ? "secondary" : "ghost"}
        size="sm"
        className={buttonClassName}
        onClick={() => onSetPlaybackMode("in_order")}
        aria-label="Playback mode one by one"
        title="Play one after another in queue order"
      >
        <ListOrdered className="mr-1 h-3.5 w-3.5" />
        1-by-1
      </Button>
      <Button
        type="button"
        variant={playbackMode === "shuffle" ? "secondary" : "ghost"}
        size="sm"
        className={buttonClassName}
        onClick={() => onSetPlaybackMode("shuffle")}
        aria-label="Playback mode shuffle"
        title="Shuffle through pending queue items"
      >
        <Shuffle className="mr-1 h-3.5 w-3.5" />
        Shuffle
      </Button>
    </div>
  );
}

export function MiniPlayerDetailsQueueControls({
  currentLoaded,
  expandedOpen,
  queueOpen,
  onToggleExpanded,
  onToggleQueue,
  className,
  buttonClassName,
  tooltipClassName,
}: {
  currentLoaded: boolean;
  expandedOpen: boolean;
  queueOpen: boolean;
  onToggleExpanded: () => void;
  onToggleQueue: () => void;
  className?: string;
  buttonClassName: string;
  tooltipClassName?: string;
}) {
  if (tooltipClassName) {
    return (
      <div className={className}>
        <MiniPlayerIconButtonControl
          variant={expandedOpen ? "secondary" : "ghost"}
          className={buttonClassName}
          onClick={onToggleExpanded}
          disabled={!currentLoaded}
          title={expandedOpen ? "Collapse release details" : "Expand release details"}
          ariaLabel={expandedOpen ? "Collapse release details" : "Expand release details"}
          tooltip={expandedOpen ? "Collapse release details" : "Expand release details"}
          tooltipClassName={tooltipClassName}
        >
          {expandedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </MiniPlayerIconButtonControl>
        <MiniPlayerIconButtonControl
          variant={queueOpen ? "secondary" : "ghost"}
          className={buttonClassName}
          onClick={onToggleQueue}
          title="Open queue"
          ariaLabel="Open queue"
          tooltip="Open queue"
          tooltipClassName={tooltipClassName}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </MiniPlayerIconButtonControl>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant={expandedOpen ? "secondary" : "ghost"}
        className={buttonClassName}
        onClick={onToggleExpanded}
        disabled={!currentLoaded}
        title={expandedOpen ? "Collapse release details" : "Expand release details"}
        aria-label={expandedOpen ? "Collapse release details" : "Expand release details"}
      >
        {expandedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={queueOpen ? "secondary" : "ghost"}
        className={buttonClassName}
        onClick={onToggleQueue}
        title="Open queue"
        aria-label="Open queue"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
