"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  subscribeRouteRefreshMutationEvents,
} from "@/lib/client-route-refresh-events";
import {
  SOURCE_PROGRESS_REFRESH_MIN_GAP_MS,
  subscribeSourceProgressRefresh,
} from "@/lib/source-progress-refresh";

const DEFAULT_DELAY_MS = 180;

export function ClientRouteRefreshBridge({ delayMs = DEFAULT_DELAY_MS }: { delayMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<number | null>(null);
  const lastSourceRefreshAtRef = useRef(0);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        router.refresh();
        timerRef.current = null;
      }, delayMs);
    };

    const unsubscribeMutationRefresh = subscribeRouteRefreshMutationEvents(() => scheduleRefresh());

    return () => {
      unsubscribeMutationRefresh();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [delayMs, router]);

  useEffect(() => {
    const search = searchParams.toString();
    return subscribeSourceProgressRefresh({
      pathname,
      search,
      onRefresh: () => router.refresh(),
      shouldRefresh: (now) => now - lastSourceRefreshAtRef.current >= SOURCE_PROGRESS_REFRESH_MIN_GAP_MS,
      markRefreshed: (now) => {
        lastSourceRefreshAtRef.current = now;
      },
    });
  }, [pathname, router, searchParams]);

  return null;
}
