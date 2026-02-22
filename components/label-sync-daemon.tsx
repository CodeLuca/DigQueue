"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const ACTIVE_TICK_MS = 1800;
const IDLE_TICK_MS = 5000;
const ERROR_TICK_MS = 8000;
const REFRESH_MIN_GAP_MS = 4500;

type NextLabelResponse = {
  nextLabelId: number | null;
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
      try {
        const nextResponse = await fetch("/api/labels/next", { cache: "no-store" });
        if (!nextResponse.ok) {
          window.setTimeout(tick, ERROR_TICK_MS);
          return;
        }
        const nextData = (await nextResponse.json()) as NextLabelResponse;
        if (!nextData.nextLabelId) {
          window.setTimeout(tick, IDLE_TICK_MS);
          return;
        }

        await fetch("/api/worker/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelId: nextData.nextLabelId }),
        });

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
