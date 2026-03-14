"use client";

export function readClientEventDetail<T>(event: Event) {
  return (event as CustomEvent<T>).detail ?? null;
}

export function dispatchClientEvent<TDetail>(eventName: string, detail?: TDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(detail === undefined ? new CustomEvent(eventName) : new CustomEvent(eventName, { detail }));
}

export function subscribeClientEvent<TDetail>(
  eventName: string,
  handler: (detail: TDetail) => void,
  options?: { parse?: (event: Event) => TDetail | null },
) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = options?.parse ? options.parse(event) : readClientEventDetail<TDetail>(event);
    if (detail !== null) handler(detail);
  };
  window.addEventListener(eventName, listener as EventListener);
  return () => window.removeEventListener(eventName, listener as EventListener);
}

export function subscribeClientSignalEvent(
  eventName: string,
  handler: () => void,
) {
  if (typeof window === "undefined") return () => {};
  const listener = () => {
    handler();
  };
  window.addEventListener(eventName, listener as EventListener);
  return () => window.removeEventListener(eventName, listener as EventListener);
}
