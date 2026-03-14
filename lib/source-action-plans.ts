export function shouldQueueActiveSourceBatch(status: string) {
  return status !== "processing" && status !== "complete";
}

export function planStartSyncSourceUpdate(input: { active: boolean; status: string }) {
  if (!input.active && input.status !== "complete") {
    return {
      active: true,
      status: "queued" as const,
      clearLastError: true,
    };
  }
  if (input.active && input.status !== "processing" && input.status !== "queued") {
    return {
      active: input.active,
      status: "queued" as const,
      clearLastError: true,
    };
  }
  return null;
}

export function shouldRetrySourceStatus(status: string) {
  return status === "error";
}

export function shouldResumePausedSource(input: { active: boolean; status: string }) {
  return !input.active && input.status === "paused";
}
