"use client";

import type { SourceControlAction, SourceRemediationAction } from "@/lib/source-action-contract";
import type { SourceControlResponse, SourceRemediationResponse } from "@/lib/source-operations-contract";

export function formatSourceControlMessage(action: SourceControlAction, result: SourceControlResponse) {
  if (action === "start") {
    return result.kickedSourceId ? "Sync started and the next source was kicked immediately." : "Sources queued for sync.";
  }

  if (action === "pause") {
    return result.affected > 0 ? `Paused ${result.affected} active sources.` : "No active sources were running.";
  }

  return result.affected > 0 ? `Cleared error flags on ${result.affected} sources.` : "No active errored sources to retry.";
}

export function formatSourceRemediationMessage(action: SourceRemediationAction, result: SourceRemediationResponse) {
  if (action === "retry_all_errors" || action === "retry_specific") {
    return result.affected > 0
      ? `Queued ${result.affected} errored ${result.affected === 1 ? "source" : "sources"} for retry.`
      : "No errored sources were queued.";
  }

  if (action === "refresh_specific_metadata") {
    return result.affected > 0
      ? `Refreshed metadata for ${result.affected} ${result.affected === 1 ? "source" : "sources"}.`
      : "No source metadata was refreshed.";
  }

  if (action === "clear_stale_locks") {
    return result.affected > 0
      ? `Cleared ${result.affected} stale ${result.affected === 1 ? "lock" : "locks"}.`
      : "No stale locks were found.";
  }

  return result.affected > 0
    ? `Paused ${result.affected} active ${result.affected === 1 ? "source" : "sources"}.`
    : "No active sources were updated.";
}
