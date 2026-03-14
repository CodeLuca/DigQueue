"use client";

import { dispatchClientEvent, subscribeClientEvent } from "@/lib/client-event-bus";

const ACCOUNT_STATE_MUTATED_EVENT = "digqueue:account-state-mutated";

export type AccountStateMutationDetail = {
  reason: "integration_disconnect" | "session_clear";
  provider?: "discogs" | "youtube";
};

function getAccountStateMutationDetail(detail: unknown): AccountStateMutationDetail {
  if (!detail || typeof detail !== "object") {
    return { reason: "session_clear" };
  }
  const candidate = detail as Partial<AccountStateMutationDetail>;
  return {
    reason: candidate.reason === "integration_disconnect" ? "integration_disconnect" : "session_clear",
    provider: candidate.provider === "discogs" || candidate.provider === "youtube" ? candidate.provider : undefined,
  };
}

export function dispatchAccountStateMutated(detail: AccountStateMutationDetail) {
  dispatchClientEvent(ACCOUNT_STATE_MUTATED_EVENT, detail);
}

export function subscribeAccountStateMutated(handler: (detail: AccountStateMutationDetail) => void) {
  return subscribeClientEvent(ACCOUNT_STATE_MUTATED_EVENT, handler, { parse: getAccountStateMutationDetail });
}
