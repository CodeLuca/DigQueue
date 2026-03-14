export type SourceControlResponse = {
  affected: number;
  kickedSourceId?: number | null;
};

export type SourceRemediationResponse = {
  nextPath: string;
  affected: number;
  failed?: number;
};

export function buildSourceControlResponse(input: {
  affected: number;
  kickedSourceId?: number | null;
}): SourceControlResponse {
  return {
    affected: input.affected,
    ...(typeof input.kickedSourceId === "number" || input.kickedSourceId === null
      ? { kickedSourceId: input.kickedSourceId }
      : {}),
  };
}

export function normalizeSourceControlResponse(
  body: Partial<{
    affected: number;
    kickedSourceId: number | null;
  }>,
): SourceControlResponse {
  return {
    affected: typeof body.affected === "number" ? body.affected : 0,
    ...(typeof body.kickedSourceId === "number" || body.kickedSourceId === null
      ? { kickedSourceId: body.kickedSourceId }
      : {}),
  };
}

export function buildSourceRemediationResponse(input: {
  nextPath: string;
  affected: number;
  failed?: number;
}): SourceRemediationResponse {
  return {
    nextPath: input.nextPath,
    affected: input.affected,
    ...(typeof input.failed === "number" ? { failed: input.failed } : {}),
  };
}

export function normalizeSourceRemediationResponse(
  body: Partial<{
    nextPath: string;
    affected: number;
    failed: number;
  }>,
): SourceRemediationResponse {
  if (!body.nextPath) {
    throw new Error("Failed to run source remediation.");
  }

  return {
    nextPath: body.nextPath,
    affected: typeof body.affected === "number" ? body.affected : 0,
    ...(typeof body.failed === "number" ? { failed: body.failed } : {}),
  };
}
