"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientFetcher } from "@/lib/client-fetcher";
import { dedupeQueueClient, removeQueueItemClient } from "@/lib/client-queue-actions";
import { subscribeQueueActivity } from "@/lib/client-queue-events";
import { fetchQueueListClient, type ClientQueueItem } from "@/lib/client-queue-state";

type UseMiniPlayerQueueOptions<TItem extends ClientQueueItem> = {
  fetcher?: ClientFetcher;
  isListeningStationTab: boolean;
  getListeningScopeEnabled: () => boolean;
  getListeningScopeTrackIds: () => number[];
  filterItems?: (items: TItem[]) => TItem[];
  onQueueActivity?: () => void | Promise<void>;
};

const QUEUE_POLL_MS = 10000;
const QUEUE_DEDUPE_MS = 60000;

export function useMiniPlayerQueue<TItem extends ClientQueueItem>(
  options: UseMiniPlayerQueueOptions<TItem>,
) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<TItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const lastQueueDedupeAtRef = useRef(0);
  const queueOpenRef = useRef(false);

  useEffect(() => {
    queueOpenRef.current = queueOpen;
  }, [queueOpen]);

  const applyScopeFilter = useCallback((items: TItem[]) => {
    if (!options.isListeningStationTab || !options.getListeningScopeEnabled()) {
      return options.filterItems ? options.filterItems(items) : items;
    }
    const allowedTrackIds = new Set(options.getListeningScopeTrackIds());
    const scoped = items.filter((item) => (item.track?.id ? allowedTrackIds.has(item.track.id) : false));
    return options.filterItems ? options.filterItems(scoped) : scoped;
  }, [options]);

  const fetchQueueItems = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const now = Date.now();
      if (now - lastQueueDedupeAtRef.current > QUEUE_DEDUPE_MS) {
        lastQueueDedupeAtRef.current = now;
        void dedupeQueueClient(undefined, { fetcher: options.fetcher }).catch(() => null);
      }
      const items = await fetchQueueListClient<TItem>({
        limit: 30,
        fetcher: options.fetcher,
        errorMessage: "Unable to load queue.",
      });
      setQueueItems(applyScopeFilter(items));
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to load queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [applyScopeFilter, options.fetcher]);

  const removeQueueItem = useCallback(async (id: number) => {
    try {
      await removeQueueItemClient(id, { fetcher: options.fetcher });
      setQueueItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to remove queue item.");
    }
  }, [options.fetcher]);

  const closeQueue = useCallback(() => {
    setQueueOpen(false);
  }, []);

  const toggleQueue = useCallback(() => {
    setQueueOpen((prev) => {
      const next = !prev;
      if (next) {
        void fetchQueueItems();
      }
      return next;
    });
  }, [fetchQueueItems]);

  useEffect(() => {
    if (!queueOpen) return;
    void fetchQueueItems();
    const interval = window.setInterval(() => void fetchQueueItems(), QUEUE_POLL_MS);
    return () => window.clearInterval(interval);
  }, [fetchQueueItems, queueOpen]);

  useEffect(() => {
    return subscribeQueueActivity(() => {
      void Promise.resolve(options.onQueueActivity?.())
        .catch(() => null)
        .then(() => {
          if (queueOpenRef.current) {
            return fetchQueueItems().catch(() => null);
          }
          return null;
        });
    });
  }, [fetchQueueItems, options]);

  const refreshQueueIfOpen = useCallback(async () => {
    if (!queueOpenRef.current) return;
    await fetchQueueItems();
  }, [fetchQueueItems]);

  return {
    closeQueue,
    fetchQueueItems,
    queueError,
    queueItems,
    queueLoading,
    queueOpen,
    removeQueueItem,
    refreshQueueIfOpen,
    setQueueItems,
    toggleQueue,
  };
}
