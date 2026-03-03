export type QueueMode = "track" | "release" | "hybrid";
export type QueueOrder = "in_order" | "shuffle";

export function normalizeQueueMode(value: string | null | undefined): QueueMode {
  if (value === "track" || value === "release" || value === "hybrid") return value;
  return "hybrid";
}

export function normalizeQueueOrder(value: string | null | undefined): QueueOrder {
  return value === "shuffle" ? "shuffle" : "in_order";
}

export function parseOptionalPositiveInt(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function parseQueueNextGetParams(url: URL) {
  return {
    currentId: parseOptionalPositiveInt(url.searchParams.get("currentId")),
    mode: normalizeQueueMode(url.searchParams.get("mode")),
    order: normalizeQueueOrder(url.searchParams.get("order")),
  };
}
