export type SourceKind = "label" | "artist";

export type SourceIntakeResponse = {
  sourceId: number | null;
  entityKind: SourceKind;
  sourceName: string;
};

export function buildSourceIntakeResponse(input: {
  sourceId: number;
  entityKind: SourceKind;
  sourceName: string;
}): SourceIntakeResponse {
  return {
    sourceId: input.sourceId,
    entityKind: input.entityKind,
    sourceName: input.sourceName,
  };
}

export function normalizeSourceIntakeResponse(
  body: Partial<{
    sourceId: number | null;
    labelId: number | null;
    entityKind: SourceKind;
    sourceName: string;
  }>,
  fallback: { source: string; entityKind?: SourceKind },
): SourceIntakeResponse {
  return {
    sourceId:
      typeof body.sourceId === "number"
        ? body.sourceId
        : typeof body.labelId === "number"
          ? body.labelId
          : null,
    entityKind: body.entityKind ?? fallback.entityKind ?? "label",
    sourceName: body.sourceName ?? fallback.source,
  };
}
