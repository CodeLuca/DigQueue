import type { SourceControlAction } from "@/lib/source-action-contract";
import {
  pauseAllActiveSourcesForUser,
  retryErroredActiveSourcesForUser,
  startSourceSyncForUser,
} from "@/lib/source-batch-actions";

export async function runSourceControlActionForUser(
  userId: string,
  action: SourceControlAction,
) {
  if (action === "start") {
    const result = await startSourceSyncForUser(userId);
    return { affected: result.affected, kickedSourceId: result.kickedSourceId };
  }

  if (action === "pause") {
    const result = await pauseAllActiveSourcesForUser(userId);
    return { affected: result.affected, kickedSourceId: null as number | null };
  }

  const result = await retryErroredActiveSourcesForUser(userId);
  return { affected: result.affected, kickedSourceId: null as number | null };
}
