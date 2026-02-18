"use client";

export function PlaybackModeSettings() {
  return (
    <div className="space-y-2">
      <p>Playback queue mode: <span className="mono">mixed</span></p>
      <p className="text-[var(--color-muted)]">DigQueue now always autoplays both track-level matches and full-release fallbacks together.</p>
    </div>
  );
}
