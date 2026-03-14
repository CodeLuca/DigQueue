"use client";

import { Button } from "@/components/ui/button";
import { useSourceProcessor } from "@/lib/use-source-processor";

type LabelSummary = { id: number; status: string; active?: boolean; lastError?: string | null };

export function QueueProcessor({ labels, disabled }: { labels: LabelSummary[]; disabled?: boolean }) {
  const {
    autoRetryErrors,
    canRun,
    errorMessage,
    pendingCount,
    running,
    setAutoRetryErrors,
    toggleRunning,
  } = useSourceProcessor(labels, disabled);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        variant={running ? "secondary" : "default"}
        onClick={toggleRunning}
        disabled={!running && !canRun}
      >
        {running ? "Stop Label Sync" : `Run Label Sync (${pendingCount})`}
      </Button>
      <Button
        variant={autoRetryErrors ? "secondary" : "outline"}
        size="sm"
        onClick={() => setAutoRetryErrors((prev) => !prev)}
      >
        {autoRetryErrors ? "Auto-Retry (safe) On" : "Auto-Retry (safe) Off"}
      </Button>
      {errorMessage ? <p className="text-[11px] text-red-300">{errorMessage}</p> : null}
    </div>
  );
}
