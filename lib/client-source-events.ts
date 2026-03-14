"use client";

import { SOURCE_STATE_MUTATED_EVENT } from "@/lib/client-events";
import { dispatchClientEvent, readClientEventDetail, subscribeClientEvent } from "@/lib/client-event-bus";
import type { SourceStatusValue } from "@/lib/source-state-contract";

export type SourceStateMutationDetail = {
  reason: "add" | "active" | "status" | "process" | "refresh" | "retry" | "delete";
  sourceId?: number | null;
  active?: boolean | null;
  status?: SourceStatusValue | null;
};

export function dispatchSourceStateMutatedEvent(detail: SourceStateMutationDetail) {
  dispatchClientEvent(SOURCE_STATE_MUTATED_EVENT, detail);
}

export function getSourceStateMutationDetail(event: Event): SourceStateMutationDetail | null {
  const detail = readClientEventDetail<Partial<SourceStateMutationDetail>>(event);
  if (
    !detail ||
    (
      detail.reason !== "add" &&
      detail.reason !== "active" &&
      detail.reason !== "status" &&
      detail.reason !== "process" &&
      detail.reason !== "refresh" &&
      detail.reason !== "retry" &&
      detail.reason !== "delete"
    )
  ) {
    return null;
  }
  return {
    reason: detail.reason,
    sourceId: typeof detail.sourceId === "number" ? detail.sourceId : null,
    active: typeof detail.active === "boolean" ? detail.active : null,
    status: detail.status ?? null,
  };
}

export function subscribeSourceStateMutated(handler: (detail: SourceStateMutationDetail) => void) {
  return subscribeClientEvent(SOURCE_STATE_MUTATED_EVENT, handler, { parse: getSourceStateMutationDetail });
}
