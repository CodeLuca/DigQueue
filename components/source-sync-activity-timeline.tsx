import { getTimelineBarStyle } from "@/lib/sync-timeline";

type SourceSyncActivityTimelineBucket = {
  minuteOffset: number;
  runs: number;
  successfulRuns: number;
  failedRuns: number;
};

export function SourceSyncActivityTimeline({
  buckets,
  className = "",
  emptyHeightClassName,
  maxRuns,
  title,
}: {
  buckets: SourceSyncActivityTimelineBucket[];
  className?: string;
  emptyHeightClassName?: string;
  maxRuns: number;
  title: React.ReactNode;
}) {
  if (buckets.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[10px] text-[var(--color-muted)]">{title}</p>
      <div className={`mt-1 flex items-end gap-0.5 rounded border border-[var(--color-border)]/60 bg-[var(--color-surface2)]/40 p-1 ${emptyHeightClassName || "h-8"}`}>
        {buckets.map((bucket, index) => {
          const { heightPct, className: barClassName } = getTimelineBarStyle(bucket, maxRuns);
          return (
            <span
              key={`${bucket.minuteOffset}-${index}`}
              title={`${bucket.runs} runs (${bucket.successfulRuns} ok, ${bucket.failedRuns} failed)`}
              className={`w-2 rounded-sm ${barClassName}`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
