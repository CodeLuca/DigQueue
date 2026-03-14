"use client";
import type { ClientFetcher } from "@/lib/client-fetcher";
import { dispatchSourceStateMutatedEvent } from "@/lib/client-source-events";
import { deleteSourceClientMutation, postSourceClientMutation } from "@/lib/client-source-mutations";
import {
  getSourceControlMutationDetail,
  getSourceRemediationMutationDetail,
  type SourceControlAction,
  type SourceRemediationAction,
} from "@/lib/source-action-contract";
import {
  normalizeSourceControlResponse,
  normalizeSourceRemediationResponse,
  type SourceControlResponse,
  type SourceRemediationResponse,
} from "@/lib/source-operations-contract";
import {
  normalizeSourceActiveMutationResponse,
  normalizeSourceProcessResponse,
  normalizeSourceStatusMutationResponse,
  type SourceActiveMutationResponse,
  type SourceProcessResponse,
  type SourceStatusMutationResponse,
  type SourceStatusValue,
} from "@/lib/source-state-contract";
import { normalizeSourceMutationResponse, type SourceMutationResponse } from "@/lib/source-mutation-contract";

type SourceActionOptions = {
  fetcher?: ClientFetcher;
};

export async function runNormalizedSourceMutation(
  path: string,
  fallbackMessage: string,
  fallbackSourceId: number,
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceMutationResponse & {
      ok?: boolean;
      error?: string;
      labelId?: number;
    }
  >(
    path,
    undefined,
    fallbackMessage,
    options,
  );
  return normalizeSourceMutationResponse(body, fallbackSourceId);
}

export async function runNormalizedSourceDeleteMutation(
  path: string,
  fallbackMessage: string,
  fallbackSourceId: number,
  options?: SourceActionOptions,
) {
  const body = await deleteSourceClientMutation<
    SourceMutationResponse & {
      ok?: boolean;
      error?: string;
      labelId?: number;
    }
  >(
    path,
    fallbackMessage,
    options,
  );
  return normalizeSourceMutationResponse(body, fallbackSourceId);
}

export function dispatchSourceMutation(
  reason: "retry" | "refresh" | "delete",
  sourceId: number,
  input?: {
    active?: boolean;
    status?: "queued" | "processing" | "paused" | "complete" | "error" | null;
  },
) {
  dispatchSourceStateMutatedEvent({
    reason,
    sourceId,
    ...(input?.active === undefined ? {} : { active: input.active }),
    ...(input?.status === undefined ? {} : { status: input.status }),
  });
}

export async function runNormalizedSourceControl(
  action: SourceControlAction,
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceControlResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/sources/control",
    { action },
    "Failed to update source sync state.",
    options,
  );
  return normalizeSourceControlResponse(body);
}

export function dispatchSourceControl(action: SourceControlAction, result: SourceControlResponse) {
  dispatchSourceStateMutatedEvent(getSourceControlMutationDetail({
    action,
    kickedSourceId: result.kickedSourceId,
  }));
}

export async function runNormalizedSourceRemediation(
  input: {
    action: SourceRemediationAction;
    nextPath: string;
    category?: string;
    actionLabel?: string;
    scopeLabel?: string;
    sourceIds?: number[];
  },
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceRemediationResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/sources/remediation",
    input,
    "Failed to run source remediation.",
    options,
  );
  return normalizeSourceRemediationResponse(body);
}

export function dispatchSourceRemediation(action: SourceRemediationAction) {
  dispatchSourceStateMutatedEvent(getSourceRemediationMutationDetail(action));
}

export async function runNormalizedSourceStatusMutation(
  sourceId: number,
  status: SourceStatusValue,
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceStatusMutationResponse & {
      ok?: boolean;
      error?: string;
      detail?: string;
      hint?: string;
    }
  >(
    `/api/labels/${sourceId}/status`,
    { status },
    "Failed to update label status.",
    options,
  );
  return normalizeSourceStatusMutationResponse(body, { sourceId, status });
}

export function dispatchSourceStatus(result: SourceStatusMutationResponse) {
  dispatchSourceStateMutatedEvent({
    reason: "status",
    sourceId: result.sourceId,
    status: result.status,
  });
}

export async function runNormalizedSourceActiveMutation(
  sourceId: number,
  active: boolean,
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceActiveMutationResponse & {
      ok?: boolean;
      error?: string;
      detail?: string;
      hint?: string;
    }
  >(
    `/api/labels/${sourceId}/active`,
    { active },
    "Activation update failed.",
    options,
  );
  return normalizeSourceActiveMutationResponse(body, {
    sourceId,
    active,
    status: active ? "queued" : "paused",
  });
}

export function dispatchSourceActive(result: SourceActiveMutationResponse) {
  dispatchSourceStateMutatedEvent({
    reason: "active",
    sourceId: result.sourceId,
    active: result.active,
    status: result.status,
  });
}

export async function runNormalizedSourceProcess(
  sourceId: number,
  options?: SourceActionOptions,
) {
  const body = await postSourceClientMutation<
    SourceProcessResponse & {
      ok?: boolean;
      error?: string;
      detail?: string;
    }
  >(
    "/api/worker/process",
    { sourceId },
    "Failed to process label.",
    options,
  );
  return normalizeSourceProcessResponse(body, sourceId);
}

export function dispatchSourceProcess(sourceId: number) {
  dispatchSourceStateMutatedEvent({
    reason: "process",
    sourceId,
  });
}
