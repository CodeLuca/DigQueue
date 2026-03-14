type SourceType = string | null | undefined;

export function mergeSourceType(existingSourceType: SourceType, incomingSourceType: SourceType) {
  const existing = existingSourceType?.trim() || null;
  const incoming = incomingSourceType?.trim() || null;
  if (existing === "workspace" || incoming === "workspace") return "workspace";
  return existing ?? incoming ?? "workspace";
}

export function shouldActivateSource(existingActive: boolean | null | undefined, incomingActive: boolean | null | undefined) {
  return Boolean(existingActive) || Boolean(incomingActive);
}

export function shouldQueueSourceAfterUpsert(input: { sourceType?: SourceType; active?: boolean | null | undefined }) {
  return input.sourceType?.trim() === "workspace" || Boolean(input.active);
}
