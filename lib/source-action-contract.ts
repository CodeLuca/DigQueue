import { z } from "zod";

export const sourceControlActionSchema = z.enum(["start", "pause", "retry_errors"]);
export type SourceControlAction = z.infer<typeof sourceControlActionSchema>;

export const sourceRemediationActionSchema = z.enum([
  "retry_all_errors",
  "retry_specific",
  "pause_all_active",
  "pause_and_clear_specific",
  "refresh_specific_metadata",
  "clear_stale_locks",
]);
export type SourceRemediationAction = z.infer<typeof sourceRemediationActionSchema>;

export type SourceMutationDetail = {
  reason: "status" | "process" | "retry" | "refresh";
  sourceId?: number | null;
  status?: "queued" | "processing" | "paused" | null;
};

export function getSourceControlMutationDetail(input: {
  action: SourceControlAction;
  kickedSourceId?: number | null;
}): SourceMutationDetail {
  return {
    reason: input.action === "retry_errors" ? "retry" : input.action === "start" ? "process" : "status",
    sourceId: input.kickedSourceId ?? null,
    status: input.action === "pause" ? "paused" : input.action === "retry_errors" ? "queued" : "processing",
  };
}

export function getSourceRemediationMutationDetail(
  action: SourceRemediationAction,
): SourceMutationDetail {
  return {
    reason:
      action === "refresh_specific_metadata"
        ? "refresh"
        : action === "retry_all_errors" || action === "retry_specific"
          ? "retry"
          : "status",
    status:
      action === "retry_all_errors" || action === "retry_specific"
        ? "queued"
        : action === "refresh_specific_metadata"
          ? null
          : "paused",
  };
}
