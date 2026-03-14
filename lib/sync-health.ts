import type { SyncTelemetry } from "@/lib/sync-types";

export type SyncHealthAlert = {
  kind: "stalled_processing" | "failure_burst" | "auth_failures";
  severity: "warning" | "critical";
  summary: string;
};

export function buildSyncHealthAlerts(input: {
  now: number;
  counts: { processing: number; error: number };
  syncTelemetry: SyncTelemetry | null;
  throughputLong: { failedRuns: number; successfulRuns: number; lastSuccessAt: number | null };
  throughputBreakdown: { failureCategories: { auth: number } };
}) {
  const alerts: SyncHealthAlert[] = [];
  const telemetryAgeMs = input.syncTelemetry ? Math.max(0, input.now - input.syncTelemetry.updatedAt) : null;

  if (input.counts.processing > 0 && (!input.syncTelemetry || (telemetryAgeMs !== null && telemetryAgeMs > 90_000))) {
    alerts.push({
      kind: "stalled_processing",
      severity: "critical",
      summary: "Processing looks stalled. No sync update for over 90s.",
    });
  }

  if (input.throughputLong.failedRuns >= 4 && input.throughputLong.failedRuns >= input.throughputLong.successfulRuns) {
    alerts.push({
      kind: "failure_burst",
      severity: "warning",
      summary: `Failures are dominating the last hour (${input.throughputLong.failedRuns} failed, ${input.throughputLong.successfulRuns} ok).`,
    });
  }

  if (input.throughputBreakdown.failureCategories.auth >= 2 && input.counts.error > 0) {
    alerts.push({
      kind: "auth_failures",
      severity: "warning",
      summary: `Auth failures are recurring (${input.throughputBreakdown.failureCategories.auth} in the last hour).`,
    });
  }

  return alerts;
}
