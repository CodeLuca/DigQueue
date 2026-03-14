import type { ClientFetcher } from "@/lib/client-fetcher";
import { getRequiredClientQuery } from "@/lib/client-queries";

export type ClientQueueItem = {
  id: number;
  youtubeVideoId: string;
  track?: { id?: number; title?: string | null } | null;
  release?: { id?: number; title?: string | null } | null;
  label?: { name?: string | null } | null;
};

type QueueTrackedItem = {
  trackId: number;
  isUpNext?: boolean;
};

type QueueListApiResponse<TItem> = {
  items?: TItem[];
};

export async function fetchQueueListClient<TItem extends ClientQueueItem>(
  options?: {
    limit?: number;
    fetcher?: ClientFetcher;
    errorMessage?: string;
  },
) {
  const body = await getRequiredClientQuery<QueueListApiResponse<TItem>>(
    `/api/queue/list?limit=${options?.limit ?? 30}`,
    { ...options, errorMessage: options?.errorMessage || "Unable to load queue." },
  );
  return body?.items ?? [];
}

export function collectQueuedTrackIds<TItem extends ClientQueueItem>(items: TItem[]) {
  return new Set(
    items
      .map((item) => item.track?.id)
      .filter((id): id is number => typeof id === "number"),
  );
}

export async function fetchQueuedTrackIdsClient<TItem extends ClientQueueItem>(
  options?: {
    limit?: number;
    fetcher?: ClientFetcher;
    errorMessage?: string;
  },
) {
  const items = await fetchQueueListClient<TItem>(options);
  return collectQueuedTrackIds(items);
}

export function applyQueuedTrackIdsToItems<TItem extends QueueTrackedItem>(
  items: TItem[],
  queuedTrackIds: ReadonlySet<number>,
) {
  let changed = false;
  const next = items.map((item) => {
    const isUpNext = queuedTrackIds.has(item.trackId);
    if (item.isUpNext === isUpNext) return item;
    changed = true;
    return { ...item, isUpNext };
  });
  return changed ? next : items;
}

export function markTrackQueuedInItems<TItem extends QueueTrackedItem>(
  items: TItem[],
  trackId: number,
) {
  let changed = false;
  const next = items.map((item) => {
    if (item.trackId !== trackId || item.isUpNext) return item;
    changed = true;
    return { ...item, isUpNext: true };
  });
  return changed ? next : items;
}
