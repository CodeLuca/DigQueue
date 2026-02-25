"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const ACTIVE_TICK_MS = 2000;
const IDLE_TICK_MS = 3500;
const ERROR_TICK_MS = 10000;
const REFRESH_MIN_GAP_MS = 1500;

type NextSourceResponse = {
  nextSourceId?: number | null;
  nextLabelId?: number | null;
  processingAttempt?: {
    attempted?: boolean;
    sourceId?: number | null;
    lockAcquired?: boolean;
    outcome?: "ok" | "error" | "skipped";
    message?: string;
    error?: string;
  };
};

export function LabelSyncDaemon() {
  const router = useRouter();
  const pathname = usePathname();
  const runningRef = useRef(true);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    runningRef.current = true;

    const shouldRefreshCurrentView = () => {
      if (pathname.startsWith("/labels/")) return true;
      if (pathname !== "/") return false;
      if (typeof window === "undefined") return true;
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      // Only force-refresh on Sources tab where ingestion progress is managed.
      return !tab || tab === "step-1";
    };

    const tick = async () => {
      if (!runningRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        window.setTimeout(tick, IDLE_TICK_MS);
        return;
      }
      try {
        const nextResponse = await fetch("/api/sources/next", { cache: "no-store" });
        if (!nextResponse.ok) {
          window.setTimeout(tick, ERROR_TICK_MS);
          return;
        }
        const nextData = (await nextResponse.json()) as NextSourceResponse;
        if (nextData.processingAttempt?.outcome === "error") {
          console.error(
            `[label-sync-daemon] source=${nextData.processingAttempt.sourceId ?? "unknown"} error=${nextData.processingAttempt.error ?? "unknown"}`,
          );
        } else if (nextData.processingAttempt?.attempted) {
          console.debug(
            `[label-sync-daemon] source=${nextData.processingAttempt.sourceId ?? "unknown"} outcome=${nextData.processingAttempt.outcome ?? "unknown"} message=${nextData.processingAttempt.message ?? ""}`,
          );
        }
        const nextSourceId = nextData.nextSourceId ?? nextData.nextLabelId ?? null;
        if (!nextSourceId) {
          window.setTimeout(tick, IDLE_TICK_MS);
          return;
        }

        const processResponse = await fetch("/api/worker/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: nextSourceId }),
        });
        if (!processResponse.ok) {
          // Back off aggressively on mutation failures to avoid lock-step retry storms.
          const backoff = processResponse.status === 429 ? ERROR_TICK_MS * 2 : ERROR_TICK_MS;
          window.setTimeout(tick, backoff);
          return;
        }

        const now = Date.now();
        if (shouldRefreshCurrentView() && now - lastRefreshAtRef.current > REFRESH_MIN_GAP_MS) {
          lastRefreshAtRef.current = now;
          router.refresh();
        }

        window.setTimeout(tick, ACTIVE_TICK_MS);
      } catch {
        window.setTimeout(tick, ERROR_TICK_MS);
      }
    };

    void tick();
    return () => {
      runningRef.current = false;
    };
  }, [pathname, router]);

  return null;
}
