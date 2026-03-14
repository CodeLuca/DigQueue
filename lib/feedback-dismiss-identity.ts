export function shouldCollapseExternalDismiss(input: {
  eventType: string;
  releaseId?: number | null;
  externalDiscogsReleaseId?: number | null;
}) {
  return (
    input.eventType === "dismiss" &&
    typeof input.releaseId === "number" &&
    input.releaseId > 0 &&
    typeof input.externalDiscogsReleaseId === "number" &&
    input.externalDiscogsReleaseId > 0
  );
}
