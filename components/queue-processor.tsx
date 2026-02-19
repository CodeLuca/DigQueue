"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LabelSummary = { id: number; status: string; active?: boolean; lastError?: string | null };

export function QueueProcessor({ labels, disabled }: { labels: LabelSummary[]; disabled?: boolean }) {
  const [running, setRunning] = useState(false);
  const [autoRetryErrors, setAutoRetryErrors] = useState(true);
  const router = useRouter();
  const runningRef = useRef(false);

  const activeLabels = useMemo(() => labels.filter((item) => item.active !== false), [labels]);
  const processingIds = useMemo(() => activeLabels.filter((item) => item.status === "processing").map((item) => item.id), [activeLabels]);
  const readyIds = useMemo(() => activeLabels.filter((item) => item.status === "queued").map((item) => item.id), [activeLabels]);
  const retryableErroredIds = useMemo(
    () =>
      activeLabels
        .filter((item) => {
          if (item.status !== "error") return false;
          const message = item.lastError?.toLowerCase() || "";
          // Blocked/misconfigured keys should be fixed in settings, not endlessly retried.
          return !(
            message.includes("api_key_service_blocked") ||
            message.includes("youtube key blocked") ||
            message.includes("missing youtube_api_key")
          );
        })
        .map((item) => item.id),
    [activeLabels],
  );

  useEffect(() => {
    runningRef.current = running;
    if (!running || disabled) return;

    const loop = async () => {
      if (!runningRef.current) return;
      const nextId = processingIds[0] ?? readyIds[0];

      if (!nextId && autoRetryErrors && retryableErroredIds.length > 0) {
        const recoverId = retryableErroredIds[0];
        await fetch(`/api/labels/${recoverId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "queued" }),
        });
        router.refresh();
        setTimeout(loop, 1000);
        return;
      }

      if (!nextId) {
        setRunning(false);
        return;
      }

      await fetch(`/api/labels/${nextId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      });

      await fetch("/api/worker/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId: nextId }),
      });

      router.refresh();
      if (runningRef.current) setTimeout(loop, 1500);
    };

    void loop();
    return () => {
      runningRef.current = false;
    };
  }, [autoRetryErrors, disabled, processingIds, readyIds, retryableErroredIds, router, running]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        variant={running ? "secondary" : "default"}
        onClick={() => setRunning((prev) => !prev)}
        disabled={
          Boolean(disabled) ||
          (!running && processingIds.length + readyIds.length + (autoRetryErrors ? retryableErroredIds.length : 0) === 0)
        }
      >
        {running ? "Stop Label Sync" : `Run Label Sync (${processingIds.length + readyIds.length})`}
      </Button>
      <Button
        variant={autoRetryErrors ? "secondary" : "outline"}
        size="sm"
        onClick={() => setAutoRetryErrors((prev) => !prev)}
      >
        {autoRetryErrors ? "Auto-Retry (safe) On" : "Auto-Retry (safe) Off"}
      </Button>
    </div>
  );
}
