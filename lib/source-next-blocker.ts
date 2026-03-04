export function resolveSourceNextBlocker(input: {
  nextSourceId: number | null;
  errorCount: number;
  activeCount: number;
}) {
  if (input.nextSourceId !== null) return null;
  if (input.errorCount > 0) return "Only errored sources remain. Retry or clear errors to continue.";
  if (input.activeCount === 0) return "No active sources.";
  return "No queued/processing sources.";
}
