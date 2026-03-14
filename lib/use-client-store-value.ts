"use client";

import { useSyncExternalStore } from "react";

export function useClientStoreValue<TValue>(
  subscribe: (callback: () => void, options?: { emitLatest?: boolean }) => () => void,
  getSnapshot: () => TValue,
) {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(onStoreChange, { emitLatest: true }),
    getSnapshot,
    getSnapshot,
  );
}
