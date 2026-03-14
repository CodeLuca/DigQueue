export type SourceMutationResponse = {
  sourceId: number;
  failed?: boolean;
};

export function buildSourceMutationResponse(input: {
  sourceId: number;
  failed?: boolean;
}): SourceMutationResponse {
  return {
    sourceId: input.sourceId,
    ...(input.failed === undefined ? {} : { failed: input.failed }),
  };
}

export function normalizeSourceMutationResponse(
  body: Partial<{
    sourceId: number | null;
    labelId: number | null;
    failed: boolean;
  }>,
  fallbackSourceId: number,
): SourceMutationResponse {
  return {
    sourceId:
      typeof body.sourceId === "number"
        ? body.sourceId
        : typeof body.labelId === "number"
          ? body.labelId
          : fallbackSourceId,
    ...(typeof body.failed === "boolean" ? { failed: body.failed } : {}),
  };
}
