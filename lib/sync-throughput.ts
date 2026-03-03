export type SyncThroughput = {
  windowMinutes: number;
  runs: number;
  successfulRuns: number;
  failedRuns: number;
  averageDurationMs: number;
  durationP50Ms: number;
  durationP90Ms: number;
  lastSuccessAt: number | null;
  timeline: Array<{ minuteOffset: number; runs: number; successfulRuns: number; failedRuns: number }>;
};

export function createZeroSyncThroughput(windowMinutes: number): SyncThroughput {
  return {
    windowMinutes,
    runs: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageDurationMs: 0,
    durationP50Ms: 0,
    durationP90Ms: 0,
    lastSuccessAt: null,
    timeline: [],
  };
}
