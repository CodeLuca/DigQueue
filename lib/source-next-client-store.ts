import type { SourceNextResponse } from "@/lib/source-next-response";
import type { ClientFetcher } from "@/lib/client-fetcher";
import { getClientQuery } from "@/lib/client-queries";
import { subscribeSourceStateMutated } from "@/lib/client-source-events";
import { createClientPollingStore } from "@/lib/client-polling-store";

export type SourceNextLike = Partial<SourceNextResponse> & {
  nextLabelId?: number | null;
};

type SourceNextSubscriber = {
  callback: (payload: SourceNextLike) => void;
  priority: "high" | "low";
};

const ACTIVE_TICK_MS = 2200;
const BACKGROUND_TICK_MS = 10000;
const IDLE_TICK_MS = 4500;
const ERROR_TICK_MS = 10000;

function getNextPollDelay(store: {
  subscribers: Set<SourceNextSubscriber>;
}) {
  const hasHighPriority = [...store.subscribers].some((subscriber) => subscriber.priority === "high");
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return BACKGROUND_TICK_MS;
  }
  return hasHighPriority ? ACTIVE_TICK_MS : IDLE_TICK_MS;
}

const sourceNextPollingStore = createClientPollingStore<
  SourceNextLike | null,
  SourceNextSubscriber,
  Record<string, never>,
  void,
  { priority?: "high" | "low"; emitLatest?: boolean }
>({
  initialData: null,
  initialExtra: {},
  defaultMode: undefined,
  createSubscriber: (callback, options) => ({
    callback,
    priority: options?.priority ?? "low",
  }),
  notify: (subscriber, payload) => {
    if (payload) subscriber.callback(payload);
  },
  poll: async () => {
    return await fetchSourceNextClient();
  },
  getNextPollDelay,
  getErrorPollDelay: () => ERROR_TICK_MS,
  shouldNotify: (payload) => Boolean(payload),
  shouldEmitLatest: (store, options) => options?.emitLatest !== false && store.lastData !== null,
  bindWakeup: (wake) => {
    subscribeSourceStateMutated(() => wake());
  },
});

export function ensureSourceNextPolling() {
  sourceNextPollingStore.ensurePolling();
}

export function subscribeSourceNextClient(
  callback: (payload: SourceNextLike) => void,
  options?: { priority?: "high" | "low"; emitLatest?: boolean },
) {
  return sourceNextPollingStore.subscribe((payload) => {
    if (payload) callback(payload);
  }, options);
}

export function getLatestSourceNextClient() {
  return sourceNextPollingStore.getLastData();
}

export async function fetchSourceNextClient(fetcher?: ClientFetcher) {
  return await getClientQuery<SourceNextLike>("/api/sources/next", { fetcher, cache: "no-store" });
}
