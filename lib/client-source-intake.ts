"use client";

import type { ClientFetcher } from "@/lib/client-fetcher";
import { postClientMutation } from "@/lib/client-mutations";
import { dispatchSourceStateMutatedEvent } from "@/lib/client-source-events";
import {
  normalizeSourceIntakeResponse,
  type SourceIntakeResponse,
} from "@/lib/source-intake-contract";

export async function addSourceClient(
  payload: { source: string; entityKind?: "label" | "artist" },
  options?: { fetcher?: ClientFetcher },
) {
  const body = await postClientMutation<Partial<SourceIntakeResponse>>(
    "/api/sources",
    payload,
    { ...options, errorMessage: "Unable to add source." },
  );
  return normalizeSourceIntakeResponse(body, payload);
}

export async function addSourceAndDispatchClient(
  payload: { source: string; entityKind?: "label" | "artist" },
  options?: { fetcher?: ClientFetcher },
) {
  const result = await addSourceClient(payload, options);
  dispatchSourceStateMutatedEvent({
    reason: "add",
    sourceId: result.sourceId,
    active: true,
    status: "queued",
  });
  return result;
}
