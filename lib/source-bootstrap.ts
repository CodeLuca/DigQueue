import { refreshSourceMetadata } from "@/lib/label-metadata";
import { processSingleReleaseForSource } from "@/lib/processing";
import { upsertSourceForUser } from "@/lib/source-upsert";

type SourceKind = "label" | "artist";

export async function warmSourceAfterUpsert(input: {
  sourceId: number;
  kind: SourceKind;
  userId: string;
}) {
  try {
    await refreshSourceMetadata(input.sourceId, input.kind, input.userId);
  } catch {
    // Non-blocking: metadata enrichment should not block source creation flows.
  }

  try {
    // Kick one immediate processing step so newly added sources do not sit idle.
    await processSingleReleaseForSource(input.sourceId, input.userId);
  } catch {
    // Background processing can continue even if the immediate kick fails.
  }
}

export async function upsertAndWarmSourceForUser(input: {
  userId: string;
  kind: SourceKind;
  externalDiscogsId: number;
  fallbackName?: string;
  active?: boolean;
  sourceType?: string;
}) {
  const sourceId = await upsertSourceForUser(input);
  await warmSourceAfterUpsert({
    sourceId,
    kind: input.kind,
    userId: input.userId,
  });
  return sourceId;
}
