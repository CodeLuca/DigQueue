"use client";

import { Badge } from "@/components/ui/badge";
import { SourceSyncActivityTimeline } from "@/components/source-sync-activity-timeline";
import { SourceSyncSection } from "@/components/source-sync-section";
import { SupportInsightCard } from "@/components/support-insight-card";
import {
  formatSourceSyncAge,
  formatSourceSyncDelta,
  formatSourceSyncDuration,
  formatSourceSyncPhase,
  getSourceSyncAnomalyBadgeClass,
  getSourceSyncAnomalyLabel,
} from "@/lib/source-sync-status-view";
import { useSourceSyncStatus } from "@/lib/use-source-sync-status";

export function SourceSyncStatus({ initialProcessingCount }: { initialProcessingCount: number }) {
  const { data, view } = useSourceSyncStatus(initialProcessingCount);

  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)]/70 p-2.5 text-xs">
      <p className="text-[var(--color-text)]">
        {view.processingCount > 0
          ? `Sync running (${view.processingCount} active ${view.processingCount === 1 ? "job" : "jobs"}).`
          : "Sync idle right now."}
      </p>
      {view.processingNames.length > 0 ? (
        <p className="mt-1 text-[var(--color-muted)]">
          <span className="hidden sm:inline">Currently processing:</span>
          <span className="sm:hidden">Now:</span>{" "}
          {view.processingNames.join(", ")}
        </p>
      ) : null}
      {data.syncTelemetry ? (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{formatSourceSyncPhase(data.syncTelemetry.phase)}</Badge>
            <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">{data.syncTelemetry.sourceKind}</Badge>
            <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">{formatSourceSyncAge(data.syncTelemetry.updatedAt)}</Badge>
          </div>
          <p className="text-[var(--color-text)]">
            <span className="hidden sm:inline">Source:</span>
            <span className="sm:hidden">Src:</span>{" "}
            {data.syncTelemetry.sourceName}
          </p>
          {data.syncTelemetry.releaseTitle ? (
            <p className="text-[var(--color-muted)]">
              <span className="hidden sm:inline">Release:</span>
              <span className="sm:hidden">Rel:</span>{" "}
              {data.syncTelemetry.releaseTitle}
            </p>
          ) : null}
          {data.syncTelemetry.trackTitle ? (
            <p className="text-[var(--color-muted)]">
              <span className="hidden sm:inline">Track now:</span>
              <span className="sm:hidden">Track:</span>{" "}
              {data.syncTelemetry.trackTitle}
              {typeof data.syncTelemetry.trackIndex === "number" && typeof data.syncTelemetry.trackTotal === "number"
                ? ` (${data.syncTelemetry.trackIndex}/${data.syncTelemetry.trackTotal})`
                : ""}
            </p>
          ) : null}
        </div>
      ) : data.blocker ? (
        <p className="mt-1 text-[var(--color-muted)]">{data.blocker}</p>
      ) : null}
      {data.throughput ? (
        <div className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2">
          {data.healthAlerts && data.healthAlerts.length > 0 ? (
            <div className="mb-2 space-y-1">
              {data.healthAlerts.map((alert) => (
                <div
                  key={alert.kind}
                  className={`rounded border px-2 py-1 text-[10px] ${
                    alert.severity === "critical"
                      ? "border-rose-500/50 bg-rose-500/12 text-rose-100"
                      : "border-amber-500/50 bg-amber-500/12 text-amber-100"
                  }`}
                >
                  {alert.summary}
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            Last {data.throughput.windowMinutes}m: {data.throughput.runs} runs
            {" "}({data.throughput.successfulRuns} ok, {data.throughput.failedRuns} failed)
          </p>
          {data.throughputComparison ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge className={getSourceSyncAnomalyBadgeClass(data.throughputComparison.anomaly)}>
                {getSourceSyncAnomalyLabel(data.throughputComparison.anomaly)}
              </Badge>
              <span className="text-[10px] text-[var(--color-muted)]">{data.throughputComparison.summary}</span>
            </div>
          ) : null}
          <p className="text-[10px] text-[var(--color-muted)]">
            Avg duration: {formatSourceSyncDuration(data.throughput.averageDurationMs)}
          </p>
          {data.throughputComparison ? (
            <p className="text-[10px] text-[var(--color-muted)]">
              <span className="hidden sm:inline">Versus previous {data.throughputComparison.currentWindowMinutes}m:</span>
              <span className="sm:hidden">Vs prev:</span>
              {" "}runs {formatSourceSyncDelta(data.throughputComparison.runDelta, (value) => `${value}`)},
              {" "}failures {formatSourceSyncDelta(data.throughputComparison.failedDelta, (value) => `${value}`)},
              {" "}avg duration {formatSourceSyncDelta(data.throughputComparison.averageDurationDeltaMs, (value) => formatSourceSyncDuration(value))}
            </p>
          ) : null}
          <p className="text-[10px] text-[var(--color-muted)]">
            p50/p90: {formatSourceSyncDuration(data.throughput.durationP50Ms)} / {formatSourceSyncDuration(data.throughput.durationP90Ms)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Last success: {data.throughput.lastSuccessAt ? formatSourceSyncAge(data.throughput.lastSuccessAt) : "none yet"}
          </p>
          {data.throughputComparison || data.throughputBreakdown ? (
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <SupportInsightCard
                title="What Changed"
                detail={
                  <p className="text-[11px] text-[var(--color-text)]">
                    {data.throughputComparison?.summary || "No recent comparison yet."}
                  </p>
                }
              />
              <SupportInsightCard
                title="Top Failure"
                detail={
                  <>
                    <p className="text-[11px] text-[var(--color-text)]">
                      {view.topFailureCategory ? `${view.topFailureCategory.label} (${view.topFailureCategory.count})` : "No failures in the current window."}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                      {view.topFailureProvider ? `Mostly ${view.topFailureProvider.label.toLowerCase()} (${view.topFailureProvider.count}).` : "No provider skew detected."}
                    </p>
                  </>
                }
              />
              <SupportInsightCard
                title="Run Mix"
                detail={
                  <>
                    <p className="text-[11px] text-[var(--color-text)]">
                      {view.dominantRunMix ? `${view.dominantRunMix.label} leading (${view.dominantRunMix.count})` : "No recent runs."}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                      {data.throughputBreakdown
                        ? `${data.throughputBreakdown.sourceKinds.label} label, ${data.throughputBreakdown.sourceKinds.artist} artist`
                        : "Awaiting recent run history."}
                    </p>
                  </>
                }
              />
            </div>
          ) : null}
          {view.timeline.length > 0 ? (
            <SourceSyncActivityTimeline
              className="mt-1"
              buckets={view.timeline}
              maxRuns={view.timelineMaxRuns}
              title={
                <>
                <span className="hidden sm:inline">Timeline (oldest to newest)</span>
                <span className="sm:hidden">Timeline</span>
                </>
              }
            />
          ) : null}
        </div>
      ) : null}
      {data.throughputLong ? (
        <SourceSyncSection
          title={
            <>
            <span className="hidden sm:inline">{data.throughputLong.windowMinutes}m trend: {data.throughputLong.runs} runs</span>
            <span className="sm:hidden">{data.throughputLong.windowMinutes}m trend</span>
            </>
          }
        >
          <p className="mt-1 hidden text-[10px] text-[var(--color-muted)] sm:block">
            Success/failed: {data.throughputLong.successfulRuns}/{data.throughputLong.failedRuns}
          </p>
          <p className="hidden text-[10px] text-[var(--color-muted)] sm:block">
            Duration p50/p90: {formatSourceSyncDuration(data.throughputLong.durationP50Ms)} / {formatSourceSyncDuration(data.throughputLong.durationP90Ms)}
          </p>
          {view.longTimelineGrouped.length > 0 ? (
            <SourceSyncActivityTimeline
              className="mt-1"
              buckets={view.longTimelineGrouped}
              emptyHeightClassName="h-7"
              maxRuns={view.longTimelineMaxRuns}
              title="5-minute grouped activity"
            />
          ) : null}
          {data.throughputBreakdown ? (
            <div className="mt-2 hidden space-y-1 sm:block">
              <p className="text-[10px] text-[var(--color-muted)]">
                Run mix: labels {data.throughputBreakdown.sourceKinds.label}, artists {data.throughputBreakdown.sourceKinds.artist}
                {data.throughputBreakdown.sourceKinds.unknown > 0 ? `, unknown ${data.throughputBreakdown.sourceKinds.unknown}` : ""}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">
                Failure providers: Discogs {data.throughputBreakdown.failureProviders.discogs}, YouTube {data.throughputBreakdown.failureProviders.youtube}
                {data.throughputBreakdown.failureProviders.unknown > 0 ? `, unknown ${data.throughputBreakdown.failureProviders.unknown}` : ""}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">
                Failure categories: auth {data.throughputBreakdown.failureCategories.auth}, rate limit {data.throughputBreakdown.failureCategories.rate_limit}, provider {data.throughputBreakdown.failureCategories.provider}, database {data.throughputBreakdown.failureCategories.database}, data {data.throughputBreakdown.failureCategories.data}
                {data.throughputBreakdown.failureCategories.unknown > 0 ? `, unknown ${data.throughputBreakdown.failureCategories.unknown}` : ""}
              </p>
            </div>
          ) : null}
        </SourceSyncSection>
      ) : null}
      {data.runHistory && data.runHistory.length > 0 ? (
        <SourceSyncSection
          title={
            <>
            <span className="hidden sm:inline">Recent run history</span>
            <span className="sm:hidden">Run history</span>
            </>
          }
        >
          <div className="mt-2 space-y-1">
            {data.runHistory.slice(0, 5).map((item) => (
              <p key={`${item.createdAt}-${item.sourceId}-${item.outcome}`} className="text-[10px] text-[var(--color-muted)]">
                {new Date(item.createdAt).toLocaleTimeString()} • {item.sourceName} • {item.outcome}
                {" "}({formatSourceSyncDuration(item.durationMs)})
                {item.error ? ` • ${item.error}` : item.message ? ` • ${item.message}` : ""}
              </p>
            ))}
          </div>
        </SourceSyncSection>
      ) : null}
      {view.recentSuccessBySource.length > 0 ? (
        <SourceSyncSection
          title={
            <>
            <span className="hidden sm:inline">Per-source recent success</span>
            <span className="sm:hidden">Recent success</span>
            </>
          }
        >
          <div className="mt-1 space-y-1">
            {view.recentSuccessBySource.map(({ sourceName, createdAt }) => (
              <p key={`${sourceName}-${createdAt}`} className="text-[10px] text-[var(--color-muted)]">
                {sourceName}: {formatSourceSyncAge(createdAt)}
              </p>
            ))}
          </div>
        </SourceSyncSection>
      ) : null}
    </div>
  );
}
