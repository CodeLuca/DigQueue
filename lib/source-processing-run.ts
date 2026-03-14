import { processSingleReleaseForSource } from "@/lib/processing";
import {
  createProcessingAttempt,
  markProcessingAttemptError,
  markProcessingAttemptLockBusy,
  markProcessingAttemptStarted,
  markProcessingAttemptSuccess,
  type ProcessingAttemptState,
} from "@/lib/source-next-processing";
import { acquireSourceWorkerLock, releaseSourceWorkerLock } from "@/lib/worker-locks";

type SourceProcessingResult = {
  done?: boolean;
  message?: string;
};

export async function runSourceProcessingAttemptForUser(input: {
  userId: string;
  sourceId: number;
  leaseMs?: number;
}) {
  let attempt: ProcessingAttemptState = markProcessingAttemptStarted(createProcessingAttempt(input.sourceId));
  const lock = await acquireSourceWorkerLock(input.userId, input.sourceId, input.leaseMs);
  if (!lock) {
    return {
      attempt: markProcessingAttemptLockBusy(attempt),
      result: null as SourceProcessingResult | null,
    };
  }

  try {
    const result = await processSingleReleaseForSource(input.sourceId, input.userId);
    attempt = markProcessingAttemptSuccess(attempt, result?.message);
    return { attempt, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    attempt = markProcessingAttemptError(attempt, message);
    return {
      attempt,
      result: null as SourceProcessingResult | null,
    };
  } finally {
    await releaseSourceWorkerLock(lock);
  }
}
