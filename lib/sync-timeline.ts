export type SyncTimelineBucket = {
  minuteOffset: number;
  runs: number;
  successfulRuns: number;
  failedRuns: number;
};

export function groupTimelineBuckets(timeline: SyncTimelineBucket[], groupSize = 5) {
  const size = Math.max(1, Math.floor(groupSize));
  const grouped: SyncTimelineBucket[] = [];
  for (let idx = 0; idx < timeline.length; idx += size) {
    const chunk = timeline.slice(idx, idx + size);
    grouped.push({
      minuteOffset: chunk[0]?.minuteOffset ?? idx,
      runs: chunk.reduce((sum, bucket) => sum + bucket.runs, 0),
      successfulRuns: chunk.reduce((sum, bucket) => sum + bucket.successfulRuns, 0),
      failedRuns: chunk.reduce((sum, bucket) => sum + bucket.failedRuns, 0),
    });
  }
  return grouped;
}

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
