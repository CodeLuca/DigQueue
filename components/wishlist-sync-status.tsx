"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { SupportText } from "@/components/support-text";
import { type WantsSyncStatus } from "@/lib/client-wishlist-sync";
import { useWishlistSyncStatus } from "@/lib/use-wishlist-sync-status";

function fmtUtc(iso?: string) {
  if (!iso) return null;
  return `${new Date(iso).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function phaseLabel(phase?: WantsSyncStatus["phase"]) {
  if (phase === "fetching_wants") return "Fetching wants";
  if (phase === "updating_existing") return "Updating existing releases";
  if (phase === "importing_missing") return "Importing missing releases";
  if (phase === "complete") return "Complete";
  if (phase === "error") return "Error";
  return "Running";
}

function errorHint(raw?: string) {
  const text = (raw || "").toLowerCase();
  if (text.includes("unauthorized")) return "reconnect Discogs";
  if (text.includes("token")) return "check Discogs token";
  if (text.includes("rate") || text.includes("429")) return "rate-limited, retry shortly";
  if (text.includes("network") || text.includes("fetch")) return "network/API issue";
  return "open Source Intake for details";
}

export function WishlistSyncStatus({
  initialStatus,
  compact = false,
}: {
  initialStatus: WantsSyncStatus | null;
  compact?: boolean;
}) {
  const { status } = useWishlistSyncStatus(initialStatus);

  const summary = useMemo(() => {
    if (!status) return "Wishlist sync has not run yet on this account.";
    if (status.status === "running") {
      const total = status.totalCount ?? 0;
      const done = status.processedCount ?? 0;
      return `${phaseLabel(status.phase)} (${done}/${total}). Started ${fmtUtc(status.startedAt)}.`;
    }
    if (status.status === "synced") {
      const at = fmtUtc(status.finishedAt) ?? "just now";
      return `Wishlist sync ${status.mode} ran at ${at}. Wants scanned ${status.wantedCount ?? 0}, newly imported ${status.importedMissingCount ?? 0}${typeof status.maxItems === "number" ? ` (limit ${status.maxItems})` : ""}.`;
    }
    if (status.status === "throttled") {
      const at = fmtUtc(status.finishedAt) ?? "just now";
      return `Wishlist auto-sync checks once per minute to avoid API limits. Last check: ${at}.`;
    }
    const at = fmtUtc(status.finishedAt) ?? "just now";
    return `Wishlist sync failed at ${at}${status.error ? `: ${status.error}` : "."}`;
  }, [status]);

  const compactLabel = useMemo(() => {
    if (!status) return "Wishlist sync: idle";
    if (status.status === "running") {
      const total = status.totalCount ?? 0;
      const done = status.processedCount ?? 0;
      return `Wishlist sync: ${phaseLabel(status.phase)} ${done}/${total}`;
    }
    if (status.status === "synced") {
      return "Wishlist sync: complete";
    }
    if (status.status === "throttled") {
      return "Wishlist sync: checks every minute";
    }
    return `Wishlist sync failed: ${errorHint(status.error)}`;
  }, [status]);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
          status?.status === "running"
            ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
            : status?.status === "error"
              ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
              : "border-[var(--color-border)] text-[var(--color-muted)]"
        }`}
        title={summary}
      >
        {status?.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {compactLabel}
      </span>
    );
  }

  return (
    <SupportText className="mt-1 inline-flex items-center gap-1.5">
      {status?.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {summary}
      {status?.status === "running" ? (
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">live</span>
      ) : null}
    </SupportText>
  );
}
