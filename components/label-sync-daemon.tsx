"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const ACTIVE_TICK_MS = 4000;
const IDLE_TICK_MS = 7000;
const ERROR_TICK_MS = 10000;
const REFRESH_MIN_GAP_MS = 4500;

type NextSourceResponse = {
  nextSourceId?: number | null;
  nextLabelId?: number | null;
};

export function LabelSyncDaemon() {
  const router = useRouter();
  const pathname = usePathname();
  const runningRef = useRef(true);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    runningRef.current = true;

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
        if ((pathname === "/" || pathname.startsWith("/labels/")) && now - lastRefreshAtRef.current > REFRESH_MIN_GAP_MS) {
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
