export type SourceStatusValue = "queued" | "processing" | "paused" | "complete" | "error";

export type SourceStatusMutationResponse = {
  sourceId: number;
  status: SourceStatusValue;
  fallback?: string | null;
};

export type SourceActiveMutationResponse = {
  sourceId: number;
  active: boolean;
  status: SourceStatusValue;
  fallback?: string | null;
};

export type SourceProcessResponse = {
  sourceId: number;
  done: boolean;
  message: string;
  outcome: "processed" | "inactive" | "paused" | "busy" | "failed";
};

export function buildSourceStatusMutationResponse(input: {
  sourceId: number;
  status: SourceStatusValue;
  fallback?: string | null;
}): SourceStatusMutationResponse {
  return {
    sourceId: input.sourceId,
    status: input.status,
    ...(input.fallback ? { fallback: input.fallback } : {}),
  };
}

export function normalizeSourceStatusMutationResponse(
  body: Partial<{
    sourceId: number;
    status: SourceStatusValue;
    fallback: string | null;
  }>,
  fallback: {
    sourceId: number;
    status: SourceStatusValue;
  },
): SourceStatusMutationResponse {
  return {
    sourceId: typeof body.sourceId === "number" ? body.sourceId : fallback.sourceId,
    status: body.status ?? fallback.status,
    ...(typeof body.fallback === "string" ? { fallback: body.fallback } : {}),
  };
}

export function buildSourceActiveMutationResponse(input: {
  sourceId: number;
  active: boolean;
  status: SourceStatusValue;
  fallback?: string | null;
}): SourceActiveMutationResponse {
  return {
    sourceId: input.sourceId,
    active: input.active,
    status: input.status,
    ...(input.fallback ? { fallback: input.fallback } : {}),
  };
}

export function normalizeSourceActiveMutationResponse(
  body: Partial<{
    sourceId: number;
    active: boolean;
    status: SourceStatusValue;
    fallback: string | null;
  }>,
  fallback: {
    sourceId: number;
    active: boolean;
    status: SourceStatusValue;
  },
): SourceActiveMutationResponse {
  return {
    sourceId: typeof body.sourceId === "number" ? body.sourceId : fallback.sourceId,
    active: typeof body.active === "boolean" ? body.active : fallback.active,
    status: body.status ?? fallback.status,
    ...(typeof body.fallback === "string" ? { fallback: body.fallback } : {}),
  };
}

export function buildSourceProcessResponse(input: {
  sourceId: number;
  done: boolean;
  message: string;
  outcome: SourceProcessResponse["outcome"];
}): SourceProcessResponse {
  return {
    sourceId: input.sourceId,
    done: input.done,
    message: input.message,
    outcome: input.outcome,
  };
}

export function normalizeSourceProcessResponse(
  body: Partial<{
    sourceId: number;
    done: boolean;
    message: string;
    outcome: SourceProcessResponse["outcome"];
  }>,
  fallbackSourceId: number,
): SourceProcessResponse {
  return {
    sourceId: typeof body.sourceId === "number" ? body.sourceId : fallbackSourceId,
    done: body.done === true,
    message: body.message || "Processed one source step.",
    outcome: body.outcome ?? "processed",
  };
}
