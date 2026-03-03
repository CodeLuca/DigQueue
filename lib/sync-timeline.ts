export type SyncTimelineBucket = {
  minuteOffset: number;
  runs: number;
  successfulRuns: number;
  failedRuns: number;
};

export function getTimelineMaxRuns(timeline: SyncTimelineBucket[]) {
  const runs = timeline.map((bucket) => bucket.runs);
  return Math.max(1, ...runs);
}

export function getTimelineBarStyle(bucket: SyncTimelineBucket, maxRuns: number) {
  const heightPct = Math.max(12, Math.round((bucket.runs / Math.max(1, maxRuns)) * 100));
  const hasErrors = bucket.failedRuns > 0;
  const hasRuns = bucket.runs > 0;
  const className = hasErrors
    ? "bg-rose-400/80"
    : hasRuns
      ? "bg-emerald-400/80"
      : "bg-zinc-500/30";
  return { heightPct, className };
}
