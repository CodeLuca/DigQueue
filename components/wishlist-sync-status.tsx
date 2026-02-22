"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type WantsSyncStatus = {
  mode: "auto" | "manual";
  status: "running" | "synced" | "throttled" | "error";
  startedAt: string;
  finishedAt?: string;
  phase?: "fetching_wants" | "updating_existing" | "importing_missing" | "complete" | "error";
  processedCount?: number;
  totalCount?: number;
  wantedCount?: number;
  loadedWantedCount?: number;
  importedMissingCount?: number;
  maxItems?: number | null;
  reason?: string;
  error?: string;
};

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

export function WishlistSyncStatus({
  initialStatus,
  compact = false,
}: {
  initialStatus: WantsSyncStatus | null;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<WantsSyncStatus | null>(initialStatus);

  useEffect(() => {
    let mounted = true;
    let autoSyncTick = 0;
    const poll = async () => {
      try {
        autoSyncTick += 1;
        if (autoSyncTick % 7 === 0 && document.visibilityState === "visible") {
          // Keep auto-sync alive while this page is open; server-side throttling prevents spam.
          void fetch("/api/wishlist/sync-auto", { method: "POST" });
        }
        const response = await fetch("/api/wishlist/sync-status", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { ok?: boolean; status?: WantsSyncStatus | null } | null;
        if (!mounted || !body?.ok) return;
        setStatus(body.status ?? null);
      } catch {
        // Best-effort status polling only.
      }
    };
    const interval = window.setInterval(() => void poll(), 3000);
    void poll();
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

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
      return `Wishlist auto-sync is throttled (max once per minute). Last check: ${at}.`;
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
      return "Wishlist sync: throttled";
    }
    return "Wishlist sync: error";
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
    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
      {status?.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {summary}
      {status?.status === "running" ? (
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">live</span>
      ) : null}
    </p>
  );
}
