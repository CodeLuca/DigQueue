"use client";

import { ResponsiveLabel } from "@/components/responsive-label";
import { Button } from "@/components/ui/button";

export function ListenInboxAutoNextToggleButton({
  enabled,
  compact = false,
  onToggle,
}: {
  enabled: boolean;
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={enabled ? "secondary" : "outline"}
      className={compact ? "h-7 px-2 text-[10px]" : "col-span-2 h-9 w-full justify-center"}
      onClick={onToggle}
      title={compact ? "Automatically play next track after reviewed actions" : "When on, reviewed actions automatically play the next track on mobile"}
      aria-label="Toggle auto-play next"
    >
      {enabled ? (compact ? "Auto-next on" : "Auto-play next on") : (compact ? "Auto-next off" : "Auto-play next off")}
    </Button>
  );
}

export function ListenInboxMobilePresetControls({
  commuteModeActive,
  compactMobileRows,
  mobileAutoAdvancePlay,
  onApplyCommuteMode,
  onResetCommuteMode,
  onToggleCompactRows,
  onToggleMobileAutoAdvancePlay,
}: {
  commuteModeActive: boolean;
  compactMobileRows: boolean;
  mobileAutoAdvancePlay: boolean;
  onApplyCommuteMode: () => void;
  onResetCommuteMode: () => void;
  onToggleCompactRows: () => void;
  onToggleMobileAutoAdvancePlay: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={commuteModeActive ? "secondary" : "outline"}
        className="h-9 w-full justify-center"
        onClick={onApplyCommuteMode}
        title="Train-friendly preset: Needs Review + Playable + hide reviewed/played"
      >
        <ResponsiveLabel compact="Commute" full="Commute Mode" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 w-full justify-center"
        onClick={onResetCommuteMode}
        disabled={!commuteModeActive}
        title="Reset commute preset filters"
      >
        <ResponsiveLabel compact="Reset" full="Reset Preset" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={compactMobileRows ? "secondary" : "outline"}
        className="col-span-2 h-9 w-full justify-center"
        onClick={onToggleCompactRows}
        title="Compact mode reduces row density for faster phone scanning"
      >
        {compactMobileRows ? "Compact rows on" : "Compact rows off"}
      </Button>
      <ListenInboxAutoNextToggleButton
        enabled={mobileAutoAdvancePlay}
        onToggle={onToggleMobileAutoAdvancePlay}
      />
    </div>
  );
}
