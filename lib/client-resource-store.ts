"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ClientResourceSnapshot<TData> = {
  status: "idle" | "loading" | "success" | "error";
  data: TData | null;
  error: string | null;
};

const EMPTY_SNAPSHOT: ClientResourceSnapshot<never> = {
  status: "idle",
  data: null,
  error: null,
};

export function createClientResourceStore<TKey extends string | number, TData>(options: {
  load: (key: TKey) => Promise<TData>;
  getErrorMessage: (error: unknown) => string;
}) {
  const state = new Map<TKey, ClientResourceSnapshot<TData>>();
  const inFlight = new Map<TKey, Promise<TData>>();
  const listeners = new Set<() => void>();

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = (key: TKey | null | undefined): ClientResourceSnapshot<TData> => {
    if (key === null || key === undefined) {
      return EMPTY_SNAPSHOT as ClientResourceSnapshot<TData>;
    }
    return state.get(key) ?? (EMPTY_SNAPSHOT as ClientResourceSnapshot<TData>);
  };

  const load = async (key: TKey) => {
    const existing = state.get(key);
    if (existing?.status === "success" && existing.data) {
      return existing.data;
    }

    const pending = inFlight.get(key);
    if (pending) return pending;

    state.set(key, {
      status: "loading",
      data: existing?.data ?? null,
      error: null,
    });
    emitChange();

    const request = options.load(key)
      .then((data) => {
        state.set(key, {
          status: "success",
          data,
          error: null,
        });
        emitChange();
        return data;
      })
      .catch((error) => {
        state.set(key, {
          status: "error",
          data: null,
          error: options.getErrorMessage(error),
        });
        emitChange();
        throw error;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  };

  return {
    subscribe,
    getSnapshot,
    load,
  };
}

export function useClientResource<TKey extends string | number, TData>(
  store: ReturnType<typeof createClientResourceStore<TKey, TData>>,
  key: TKey | null | undefined,
  options?: { enabled?: boolean; missingMessage?: string },
) {
  const enabled = options?.enabled ?? false;
  const snapshot = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot(key),
    () => EMPTY_SNAPSHOT as ClientResourceSnapshot<TData>,
  );

  useEffect(() => {
    if (!enabled || key === null || key === undefined || snapshot.status !== "idle") return;
    void store.load(key);
  }, [enabled, key, snapshot.status, store]);

  const load = useCallback(async () => {
    if (key === null || key === undefined) return null;
    return store.load(key);
  }, [key, store]);

  if (!enabled) {
    return {
      result: snapshot.data,
      pending: snapshot.status === "loading",
      error: snapshot.error,
      load,
    };
  }

  if (key === null || key === undefined) {
    return {
      result: null,
      pending: false,
      error: options?.missingMessage ?? null,
      load,
    };
  }

  return {
    result: snapshot.data,
    pending: snapshot.status === "loading",
    error: snapshot.error,
    load,
  };
}
