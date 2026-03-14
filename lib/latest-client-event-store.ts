"use client";

type SubscribeDetail<TDetail> = (handler: (detail: TDetail) => void) => () => void;

export function createLatestClientEventStore<TDetail>(options: {
  publish: (detail: TDetail) => void;
  subscribe: SubscribeDetail<TDetail>;
  onEmitLatestMiss?: () => void;
}) {
  let latest: TDetail | null = null;
  let unsubscribe: (() => void) | null = null;
  const subscribers = new Set<(detail: TDetail) => void>();

  const ensureStore = () => {
    if (unsubscribe || typeof window === "undefined") return;
    unsubscribe = options.subscribe((detail) => {
      latest = detail;
      for (const subscriber of subscribers) subscriber(detail);
    });
  };

  return {
    publish(detail: TDetail) {
      latest = detail;
      options.publish(detail);
    },
    getLastDetail() {
      return latest;
    },
    subscribe(
      handler: (detail: TDetail) => void,
      subscribeOptions?: { emitLatest?: boolean },
    ) {
      ensureStore();
      subscribers.add(handler);
      if (subscribeOptions?.emitLatest) {
        if (latest) {
          handler(latest);
        } else {
          options.onEmitLatestMiss?.();
        }
      }
      return () => {
        subscribers.delete(handler);
      };
    },
  };
}
