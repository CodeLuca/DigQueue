"use client";

import { useEffect, useRef } from "react";
import { subscribeReleaseWishlistUpdated, subscribeTrackTodoUpdated } from "@/lib/client-library-events";
import { mapItemsByTrackTodoUpdate } from "@/lib/client-track-todo-state";
import { subscribeQueueTrackEnqueued } from "@/lib/client-queue-events";
import { publishListeningScope } from "@/lib/listening-scope-client-store";
import {
  applyAffectedReleaseWishlistToRows,
  filterSavedRows,
} from "@/lib/client-listen-row-state";
import { markTrackQueuedInItems } from "@/lib/client-queue-state";
import type { ListenRow } from "@/lib/listen-inbox-types";

export function useListenInboxLiveSync({
  activeLabelId,
  scopedTrackIds,
  setBaseRows,
  showQueueFilters,
}: {
  activeLabelId: number | null;
  scopedTrackIds: number[];
  setBaseRows: React.Dispatch<React.SetStateAction<ListenRow[]>>;
  showQueueFilters: boolean;
}) {
  const lastScopeDispatchKeyRef = useRef("");
  const scopeDispatchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeTrackTodoUpdated(({ trackId, field, value }) => {
      setBaseRows((prev) => {
        const next = mapItemsByTrackTodoUpdate(
          prev,
          { trackId, field, value },
          (row) => row.trackId,
          (row, nextField, nextValue) =>
            nextField === "saved"
              ? { ...row, saved: nextValue }
              : { ...row, listened: nextValue },
        );
        return showQueueFilters ? next : filterSavedRows(next);
      });
    });
  }, [setBaseRows, showQueueFilters]);

  useEffect(() => {
    return subscribeQueueTrackEnqueued(({ trackId }) => {
      setBaseRows((prev) => markTrackQueuedInItems(prev, trackId));
    });
  }, [setBaseRows]);

  useEffect(() => {
    return subscribeReleaseWishlistUpdated(({ releaseIds, value }) => {
      setBaseRows((prev) => applyAffectedReleaseWishlistToRows(prev, releaseIds, value));
    });
  }, [setBaseRows]);

  useEffect(() => {
    const trackIds = scopedTrackIds.slice(0, 1200);
    const scopeKey = `${showQueueFilters ? "1" : "0"}|${activeLabelId ?? "none"}|${trackIds.join(",")}`;
    if (scopeKey === lastScopeDispatchKeyRef.current) return;
    lastScopeDispatchKeyRef.current = scopeKey;
    if (scopeDispatchTimerRef.current !== null) {
      window.clearTimeout(scopeDispatchTimerRef.current);
    }
    scopeDispatchTimerRef.current = window.setTimeout(() => {
      publishListeningScope({
        enabled: showQueueFilters,
        trackIds,
        activeLabelId,
      });
      scopeDispatchTimerRef.current = null;
    }, 120);
    return () => {
      if (scopeDispatchTimerRef.current !== null) {
        window.clearTimeout(scopeDispatchTimerRef.current);
        scopeDispatchTimerRef.current = null;
      }
    };
  }, [activeLabelId, scopedTrackIds, showQueueFilters]);
}
