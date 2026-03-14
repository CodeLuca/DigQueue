"use client";

type SubscriberFactory<TData, TSubscriber, TOptions> = (
  callback: (data: TData) => void,
  options?: TOptions,
) => TSubscriber;

type PollingStoreState<TData, TSubscriber, TExtra> = {
  subscribers: Set<TSubscriber>;
  timerId: number | null;
  inFlight: Promise<void> | null;
  lastData: TData;
  extra: TExtra;
};

export function createClientPollingStore<
  TData,
  TSubscriber,
  TExtra,
  TPollMode = void,
  TSubscribeOptions extends { emitLatest?: boolean } = { emitLatest?: boolean },
>(options: {
  initialData: TData;
  initialExtra: TExtra;
  defaultMode: TPollMode;
  createSubscriber: SubscriberFactory<TData, TSubscriber, TSubscribeOptions>;
  notify: (subscriber: TSubscriber, data: TData) => void;
  poll: (store: PollingStoreState<TData, TSubscriber, TExtra>, mode: TPollMode) => Promise<TData>;
  getNextPollDelay: (store: PollingStoreState<TData, TSubscriber, TExtra>) => number;
  getErrorPollDelay: (store: PollingStoreState<TData, TSubscriber, TExtra>) => number;
  shouldStartPolling?: (store: PollingStoreState<TData, TSubscriber, TExtra>, mode: TPollMode) => boolean;
  shouldNotify?: (data: TData, store: PollingStoreState<TData, TSubscriber, TExtra>) => boolean;
  shouldEmitLatest?: (store: PollingStoreState<TData, TSubscriber, TExtra>, options?: TSubscribeOptions) => boolean;
  bindWakeup?: (wake: (mode?: TPollMode) => void) => void;
}) {
  const store: PollingStoreState<TData, TSubscriber, TExtra> = {
    subscribers: new Set<TSubscriber>(),
    timerId: null,
    inFlight: null,
    lastData: options.initialData,
    extra: options.initialExtra,
  };
  let wakeupBound = false;

  const notifySubscribers = (data: TData) => {
    for (const subscriber of store.subscribers) {
      options.notify(subscriber, data);
    }
  };

  const scheduleNextPoll = (delay: number) => {
    window.clearTimeout(store.timerId ?? undefined);
    store.timerId = window.setTimeout(() => {
      void ensurePolling();
    }, delay);
  };

  const runPoll = async (mode: TPollMode) => {
    try {
      const data = await options.poll(store, mode);
      store.lastData = data;
      if (options.shouldNotify?.(data, store) ?? true) {
        notifySubscribers(data);
      }
    } finally {
      store.inFlight = null;
      if (store.subscribers.size === 0) return;
      scheduleNextPoll(options.getNextPollDelay(store));
    }
  };

  const ensurePolling = (mode: TPollMode = options.defaultMode) => {
    if (store.subscribers.size === 0 || store.inFlight) return;
    if (options.shouldStartPolling && !options.shouldStartPolling(store, mode)) return;
    store.inFlight = runPoll(mode).catch(() => {
      store.inFlight = null;
      if (store.subscribers.size === 0) return;
      scheduleNextPoll(options.getErrorPollDelay(store));
    });
  };

  const wake = (mode: TPollMode = options.defaultMode) => {
    if (store.subscribers.size === 0) return;
    window.clearTimeout(store.timerId ?? undefined);
    store.timerId = null;
    void ensurePolling(mode);
  };

  const bindWakeup = () => {
    if (wakeupBound || !options.bindWakeup || typeof window === "undefined") return;
    wakeupBound = true;
    options.bindWakeup(wake);
  };

  return {
    getLastData() {
      return store.lastData;
    },
    subscribe(callback: (data: TData) => void, subscribeOptions?: TSubscribeOptions) {
      const subscriber = options.createSubscriber(callback, subscribeOptions);
      store.subscribers.add(subscriber);
      bindWakeup();
      if (options.shouldEmitLatest?.(store, subscribeOptions) ?? subscribeOptions?.emitLatest !== false) {
        options.notify(subscriber, store.lastData);
      }
      void ensurePolling();

      return () => {
        store.subscribers.delete(subscriber);
        if (store.subscribers.size === 0 && store.timerId !== null) {
          window.clearTimeout(store.timerId);
          store.timerId = null;
        }
      };
    },
    ensurePolling,
    wake,
    store,
  };
}
