"use client";

import type { ReactNode } from "react";
import { DiscogsLink } from "@/components/discogs-link";
import { Button } from "@/components/ui/button";

export function MiniPlayerNowPlaying({
  currentTrackTitle,
  currentCatalogNumber,
  currentDiscogsUrl,
  currentArtistLine,
  releaseMeta,
  liveBpmStatus,
  currentBpmValue,
  bpmInputLabel,
  currentBpmLabel,
  onToggleLiveBpm,
  sliderValue,
  sliderMax,
  formatPlaybackTime,
  onSeek,
}: {
  currentTrackTitle?: string | null;
  currentCatalogNumber?: string | null;
  currentDiscogsUrl?: string | null;
  currentArtistLine?: string | null;
  releaseMeta: ReactNode;
  liveBpmStatus: "off" | "starting" | "detecting" | "running" | "error";
  currentBpmValue: string;
  bpmInputLabel: string | null;
  currentBpmLabel: string;
  onToggleLiveBpm: () => void;
  sliderValue: number;
  sliderMax: number;
  formatPlaybackTime: (seconds: number) => string;
  onSeek: (next: number) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-[var(--color-text)] sm:text-base md:text-lg">
        {currentTrackTitle || "Now Playing"}
        {currentCatalogNumber ? <span className="ml-1 text-xs font-medium text-[var(--color-muted)]">({currentCatalogNumber})</span> : null}
        {currentDiscogsUrl ? (
          <DiscogsLink
            className="ml-1"
            discogsUrl={currentDiscogsUrl}
            title="Open release on Discogs"
            variant="inlineIcon"
          />
        ) : null}
      </div>
      <div className="truncate text-xs text-[var(--color-muted)]">{currentArtistLine}</div>
      <div className="truncate text-xs text-[var(--color-muted)]">{releaseMeta}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
            liveBpmStatus === "running"
              ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100"
              : "border-[var(--color-border)] text-[var(--color-text)]"
          }`}
          aria-live="polite"
        >
          BPM {currentBpmValue}{bpmInputLabel ? ` · ${bpmInputLabel === "Mic input" ? "mic" : "tab"}` : ""}
        </span>
        {liveBpmStatus !== "running" ? <span className="truncate text-[10px]">{currentBpmLabel}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-5 rounded-md border border-[var(--color-border)] px-1.5 text-[10px]"
          onClick={onToggleLiveBpm}
          title={liveBpmStatus === "off" || liveBpmStatus === "error" ? "Enable live BPM from shared tab audio" : "Stop live BPM detection"}
          aria-label={liveBpmStatus === "off" || liveBpmStatus === "error" ? "Enable live BPM" : "Stop live BPM"}
        >
          {liveBpmStatus === "off" || liveBpmStatus === "error" ? "BPM" : "Stop"}
        </Button>
      </div>
      <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
        <span className="w-8 text-right text-[11px] text-[var(--color-muted)] sm:w-10">{formatPlaybackTime(sliderValue)}</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          value={sliderValue}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="h-1 w-full accent-[var(--color-accent)]"
          aria-label="Track timeline"
        />
        <span className="w-8 text-[11px] text-[var(--color-muted)] sm:w-10">{formatPlaybackTime(sliderMax)}</span>
      </div>
    </div>
  );
}
