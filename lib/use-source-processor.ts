"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  dispatchSourceProcess,
  dispatchSourceStatus,
  runNormalizedSourceProcess,
  runNormalizedSourceStatusMutation,
} from "@/lib/client-source-action-service";
import { buildSourceProcessorQueues } from "@/lib/source-next-processing";

type SourceProcessorLabel = {
  id: number;
  status: string;
  active?: boolean;
  lastError?: string | null;
};

export function useSourceProcessor(labels: SourceProcessorLabel[], disabled?: boolean) {
  const [running, setRunning] = useState(false);
  const [autoRetryErrors, setAutoRetryErrors] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runningRef = useRef(false);

  const queueState = useMemo(
    () => buildSourceProcessorQueues(labels),
    [labels],
  );

  useEffect(() => {
    runningRef.current = running;
    if (!running || disabled) return;

    const loop = async () => {
      if (!runningRef.current) return;
      try {
        const nextId = queueState.nextSourceId;

        if (!nextId && autoRetryErrors && queueState.retryableErroredIds.length > 0) {
          const recoverId = queueState.retryableErroredIds[0];
          const recovered = await runNormalizedSourceStatusMutation(recoverId, "queued");
          dispatchSourceStatus(recovered);
          setTimeout(loop, 1000);
          return;
        }

        if (!nextId) {
          setRunning(false);
          return;
        }

        const updating = await runNormalizedSourceStatusMutation(nextId, "processing");
        dispatchSourceStatus(updating);
        const processed = await runNormalizedSourceProcess(nextId);
        dispatchSourceProcess(processed.sourceId);

        if (runningRef.current) setTimeout(loop, 1500);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Label sync failed.");
        setRunning(false);
      }
    };

    void loop();
    return () => {
      runningRef.current = false;
    };
  }, [autoRetryErrors, disabled, queueState, running]);

  const pendingCount = queueState.processingIds.length + queueState.readyIds.length;
  const canRun = !disabled && (pendingCount + (autoRetryErrors ? queueState.retryableErroredIds.length : 0) > 0);

  const toggleRunning = () => {
    setErrorMessage(null);
    setRunning((prev) => !prev);
  };

  return {
    autoRetryErrors,
    canRun,
    errorMessage,
    pendingCount,
    running,
    setAutoRetryErrors,
    toggleRunning,
  };
}
