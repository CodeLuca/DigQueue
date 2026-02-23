export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Disc3,
  ExternalLink,
  Heart,
  History,
  Inbox,
  Lightbulb,
  PlayCircle,
  RefreshCcw,
} from "lucide-react";
import {
  addSourceAction,
  pullDiscogsWantsAction,
  refreshLabelMetadataAction,
  refreshMissingLabelMetadataAction,
  retryErroredLabelsAction,
  retryLabelAction,
} from "@/app/actions";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { LabelDeleteButton } from "@/components/label-delete-button";
import { ListenInboxClient } from "@/components/listen-inbox-client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ProcessingToggle } from "@/components/processing-toggle";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { SyncSavedToDiscogsButton } from "@/components/sync-saved-to-discogs-button";
import { YoutubePlaylistExportButton } from "@/components/youtube-playlist-export-button";
import { WishlistSyncStatus } from "@/components/wishlist-sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { getBandcampWishlistData } from "@/lib/bandcamp-wishlist";
import { toDiscogsWebUrl } from "@/lib/discogs-links";
import { getDiscogsWantsSyncStatus, syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";
import { getDashboardData, getPlayedReviewedData, getToListenData, getWishlistData } from "@/lib/queries";
import { readSyncTelemetry } from "@/lib/sync-telemetry";
import { getVisibleLabelError, isTransientLabelError } from "@/lib/utils";
import { getYoutubeOAuthConnectionStatus } from "@/lib/youtube-oauth";

function normalizeLabelStatus(active: boolean, status: string, lastError: string | null) {
  if (!active && status === "processing") return "paused";
  if (status === "error" && isTransientLabelError(lastError)) return "processing";
  return status;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ listenLabel?: string; tab?: string; labelState?: string; sourceKind?: string; labelQuery?: string; libraryView?: string }>;
}) {
  const userId = await requireCurrentAppUserId();
  const { listenLabel, tab, labelState, sourceKind, labelQuery, libraryView } = await searchParams;
  const tabIds = ["step-1", "step-2", "library", "recommendations"] as const;
  type TabId = (typeof tabIds)[number];
  const legacyLibraryView = tab === "wishlist" ? "library" : tab === "played-reviewed" || tab === "played-done" ? "history" : null;
  const normalizedTab =
    tab === "step-3" ? "step-2" : tab === "wishlist" || tab === "played-reviewed" || tab === "played-done" ? "library" : tab;
  const activeTab: TabId = tabIds.includes(normalizedTab as TabId) ? (normalizedTab as TabId) : "step-1";
  const selectedLibraryView: "library" | "history" | "reviewed" | "needs-review" =
    libraryView === "library" || libraryView === "history" || libraryView === "reviewed" || libraryView === "needs-review"
      ? libraryView
      : libraryView === "saved"
        ? "library"
        : libraryView === "played"
          ? "history"
          : (legacyLibraryView ?? "library");
  const selectedListenLabelId = listenLabel ? Number(listenLabel) : undefined;
  const selectedLabelState: "all" | "active" | "inactive" =
    labelState === "active" || labelState === "inactive" ? labelState : "all";
  const selectedSourceKind: "all" | "label" | "artist" =
    sourceKind === "label" || sourceKind === "artist" ? sourceKind : "all";
  const normalizedLabelQuery = (labelQuery || "").trim().toLowerCase();

  const showLibraryItemsSection = activeTab === "library" && selectedLibraryView === "library";
  const showPlayedReviewedSection =
    activeTab === "library" &&
    (selectedLibraryView === "history" || selectedLibraryView === "reviewed" || selectedLibraryView === "needs-review");

  const keys = await getEffectiveApiKeys();
  const hasDiscogs = Boolean(keys.discogsToken);
  const wantsSyncStatus = hasDiscogs ? await getDiscogsWantsSyncStatus().catch(() => null) : null;
  if (hasDiscogs && showLibraryItemsSection) {
    // Warm local wants state in background; don't block wishlist navigation.
    void syncDiscogsWantsToLocal().catch(() => null);
    // Warm Bandcamp cache in background while rendering from cached snapshot.
    void getBandcampWishlistData().catch(() => null);
  }

  const [data, listenData, wishlistData, playedReviewedData, bandcampWishlist] = await Promise.all([
    getDashboardData({ includeRecommendations: activeTab === "recommendations", tab: activeTab }),
    activeTab === "step-2" ? getToListenData(undefined, false) : Promise.resolve(null),
    showLibraryItemsSection ? getWishlistData(undefined, false) : Promise.resolve(null),
    showPlayedReviewedSection ? getPlayedReviewedData(undefined, false) : Promise.resolve(null),
    showLibraryItemsSection
      ? getBandcampWishlistData({ cachedOnly: true }).catch(() => ({
          enabled: false,
          sourceUrl: null,
          totalCount: 0,
          items: [],
          fetchedAt: null,
          partial: false,
        }))
      : Promise.resolve({
          enabled: false,
          sourceUrl: null,
          totalCount: 0,
          items: [],
          fetchedAt: null,
          partial: false,
        }),
  ]);

  const hasYoutubeKey = Boolean(keys.youtubeApiKey);
  const hasYoutubeBlockedError = false;
  const showIntegrationAlerts = !hasDiscogs || hasYoutubeBlockedError || !hasYoutubeKey;
  const showWishlistHeaderPill = hasDiscogs && activeTab !== "step-2";
  const hasAnySources = data.labels.length > 0;
  const showOnboarding = !hasDiscogs || !hasAnySources;
  const onboardingPrimaryHref = !hasDiscogs ? "/connect-discogs?next=/" : "/?tab=step-1";
  const onboardingPrimaryLabel = !hasDiscogs ? "Connect Discogs" : "Open Sources";

  const isLabelsTab = activeTab === "step-1";
  const canProcess = hasDiscogs;
  const useSimpleSourcesView = data.labels.length <= 3 && !normalizedLabelQuery && selectedLabelState === "all" && selectedSourceKind === "all";
  const activeLabels = data.labels.filter((label) => label.active);
  const processingSourceNames = activeLabels
    .filter((label) => {
      const normalized = normalizeLabelStatus(Boolean(label.active), label.status, label.lastError);
      const effective = label.tracksFullyLoaded ? "complete" : normalized;
      return effective === "processing";
    })
    .map((label) => label.name)
    .slice(0, 3);
  const processingSourceProgress = activeLabels
    .filter((label) => {
      const normalized = normalizeLabelStatus(Boolean(label.active), label.status, label.lastError);
      const effective = label.tracksFullyLoaded ? "complete" : normalized;
      return effective === "processing";
    })
    .map((label) => {
      const totalPages = Math.max(1, Number(label.totalPages ?? 1));
      const currentPage = Math.min(totalPages, Math.max(1, Number(label.currentPage ?? 1)));
      return {
        id: label.id,
        name: label.name,
        currentPage,
        totalPages,
        fetchedReleaseCount: label.fetchedReleaseCount,
        loadedReleaseCount: label.loadedReleaseCount,
      };
    })
    .slice(0, 4);
  const syncTelemetry = await readSyncTelemetry(userId).catch(() => null);
  const activeStatusCounts = activeLabels.reduce(
    (acc, label) => {
      const normalized = normalizeLabelStatus(Boolean(label.active), label.status, label.lastError);
      const effective = label.tracksFullyLoaded ? "complete" : normalized;
      if (effective === "queued") acc.queued += 1;
      else if (effective === "processing") acc.processing += 1;
      else if (effective === "error") acc.error += 1;
      else if (effective === "paused") acc.paused += 1;
      else if (effective === "complete") acc.complete += 1;
      else acc.other += 1;
      return acc;
    },
    { queued: 0, processing: 0, error: 0, paused: 0, complete: 0, other: 0 },
  );
  const queriedLabels = isLabelsTab
    ? data.labels.filter((label) => {
        if (!normalizedLabelQuery) return true;
        const haystack = `${label.name} ${label.summaryText} ${label.discogsUrl}`.toLowerCase();
        if (haystack.includes(normalizedLabelQuery)) return true;
        try {
          const notable = JSON.parse(label.notableReleasesJson) as string[];
          return notable.some((entry) => entry.toLowerCase().includes(normalizedLabelQuery));
        } catch {
          return false;
        }
      })
    : [];
  const filteredLabels = isLabelsTab
    ? queriedLabels.filter((label) => {
        if (selectedLabelState === "active") return label.active;
        if (selectedLabelState === "inactive") return !label.active;
        if (selectedSourceKind === "label") return label.entityKind !== "artist";
        if (selectedSourceKind === "artist") return label.entityKind === "artist";
        return true;
      })
    : [];
  const activeFilteredCount = queriedLabels.filter((label) => label.active).length;
  const inactiveFilteredCount = queriedLabels.length - activeFilteredCount;
  const filterHref = (nextState: "all" | "active" | "inactive") => {
    const params = new URLSearchParams();
    params.set("tab", "step-1");
    if (listenLabel) params.set("listenLabel", listenLabel);
    if (nextState !== "all") params.set("labelState", nextState);
    if (selectedSourceKind !== "all") params.set("sourceKind", selectedSourceKind);
    if (normalizedLabelQuery) params.set("labelQuery", labelQuery?.trim() || "");
    return `/?${params.toString()}`;
  };
  const kindHref = (nextKind: "all" | "label" | "artist") => {
    const params = new URLSearchParams();
    params.set("tab", "step-1");
    if (listenLabel) params.set("listenLabel", listenLabel);
    if (selectedLabelState !== "all") params.set("labelState", selectedLabelState);
    if (nextKind !== "all") params.set("sourceKind", nextKind);
    if (normalizedLabelQuery) params.set("labelQuery", labelQuery?.trim() || "");
    return `/?${params.toString()}`;
  };
  const clearSearchHref = (() => {
    const params = new URLSearchParams();
    params.set("tab", "step-1");
    if (listenLabel) params.set("listenLabel", listenLabel);
    if (selectedLabelState !== "all") params.set("labelState", selectedLabelState);
    if (selectedSourceKind !== "all") params.set("sourceKind", selectedSourceKind);
    return `/?${params.toString()}`;
  })();
  const libraryViewHref = (nextView: "library" | "history" | "reviewed" | "needs-review") => {
    const params = new URLSearchParams();
    params.set("tab", "library");
    if (listenLabel) params.set("listenLabel", listenLabel);
    params.set("libraryView", nextView);
    return `/?${params.toString()}`;
  };
  const libraryRows = wishlistData?.rows ?? [];
  const historyRows = (playedReviewedData?.rows ?? []).filter((row) => (row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed));
  const reviewedRows = (playedReviewedData?.rows ?? []).filter((row) => row.listened);
  const needsReviewRows = (playedReviewedData?.rows ?? []).filter(
    (row) => !row.listened && ((row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed)),
  );
  const totalSavedCount = libraryRows.length;
  const playableSavedCount = libraryRows.filter((row) => row.saved && Boolean(row.youtubeVideoId)).length;
  const youtubeOAuth =
    activeTab === "library"
      ? await getYoutubeOAuthConnectionStatus()
      : { configured: false, connected: false, channelId: null, channelTitle: null, scope: null };
  const historyCount = historyRows.length;
  const reviewedCount = reviewedRows.length;
  const needsReviewCount = needsReviewRows.length;
  const totalWishlistedRecords = data.metrics.wishlistedRecords;
  const tabMeta: Record<TabId, { title: string; subtitle: string; icon: typeof Disc3 }> = {
    "step-1": {
      title: "Sources",
      subtitle: "Add sources, activate what you want to process, and load releases into your queue.",
      icon: Disc3,
    },
    "step-2": {
      title: "Listening Station",
      subtitle: "Play tracks, mark reviewed, save standouts, and move through the queue quickly.",
      icon: Inbox,
    },
    library: {
      title: "Library",
      subtitle: "Browse saved tracks, playback history, and reviewed items.",
      icon: Bookmark,
    },
    recommendations: {
      title: "Recommendations",
      subtitle: "Suggested tracks and releases based on your activity.",
      icon: Lightbulb,
    },
  };
  const tabGuide: Record<TabId, { shellClass: string }> = {
    "step-1": {
      shellClass: "border-l-4 border-l-cyan-400/70 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),transparent_46%),var(--color-surface2)]",
    },
    "step-2": {
      shellClass: "border-l-4 border-l-emerald-400/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_46%),var(--color-surface2)]",
    },
    library: {
      shellClass: "border-l-4 border-l-amber-400/70 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),transparent_46%),var(--color-surface2)]",
    },
    recommendations: {
      shellClass: "border-l-4 border-l-sky-400/70 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),transparent_46%),var(--color-surface2)]",
    },
  };
  const activeMeta = tabMeta[activeTab];
  const ActiveTabIcon = activeMeta.icon;
  const activeGuide = tabGuide[activeTab];
  return (
    <main className="pb-player-safe mx-auto max-w-[1400px] px-3 py-4 sm:px-4 md:px-8 md:py-6">
      <KeyboardShortcuts />

      <header className={`mb-5 rounded-xl border border-[var(--color-border)] p-4 reveal ${activeGuide.shellClass}`}>
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <ActiveTabIcon className="h-6 w-6 text-[var(--color-accent)]" />
            {activeMeta.title}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">{activeMeta.subtitle}</p>
          {showIntegrationAlerts ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {!hasDiscogs ? <Badge className="border-amber-600/50 text-amber-300">Discogs Not Connected</Badge> : null}
              {hasYoutubeBlockedError ? (
                <Badge className="border-red-600/50 text-red-300">YouTube Blocked</Badge>
              ) : !hasYoutubeKey ? (
                <Badge className="border-amber-600/50 text-amber-300">YouTube Missing Key</Badge>
              ) : null}
              {showWishlistHeaderPill ? <WishlistSyncStatus initialStatus={wantsSyncStatus} compact /> : null}
            </div>
          ) : null}
          {!showIntegrationAlerts && showWishlistHeaderPill ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <WishlistSyncStatus initialStatus={wantsSyncStatus} compact />
            </div>
          ) : null}
        </div>
      </header>

      {showOnboarding ? (
        <section className="mb-5 reveal reveal-delay-1">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Quick Start</p>
            <p className="mt-1 text-sm">
              {!hasDiscogs
                ? "Connect Discogs first. After that, add or pull sources and start listening."
                : "You are connected. Add your first source (or import recent wishlist records) to start building the queue."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={hasDiscogs ? "border-emerald-600/60 text-emerald-300" : "border-amber-600/50 text-amber-300"}>
                Discogs {hasDiscogs ? "Connected" : "Not Connected"}
              </Badge>
              <Badge className={hasAnySources ? "border-emerald-600/60 text-emerald-300" : "border-amber-600/50 text-amber-300"}>
                Sources {hasAnySources ? `${data.labels.length} Loaded` : "None Yet"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={onboardingPrimaryHref}>
                <Button type="button">{onboardingPrimaryLabel}</Button>
              </Link>
              {hasDiscogs && !hasAnySources ? (
                <form action={pullDiscogsWantsAction}>
                  <FormSubmitButton
                    type="submit"
                    variant="outline"
                    pendingText="Importing..."
                    title="Imports your most recent 200 Discogs wants into Library. Does not auto-activate sources."
                  >
                    Import recent wishlist records
                  </FormSubmitButton>
                </form>
              ) : null}
              <Link href="/how-to-use">
                <Button type="button" variant="ghost">How to use</Button>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "step-2" ? (
      <section className="mb-5 reveal reveal-delay-1">
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Current Loaded Sources Stats</p>
          <p className="text-xs text-[var(--color-muted)]">{activeLabels.length} active loaded sources in scope</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <PlayCircle className="h-3.5 w-3.5" />
              Unplayed
            </p>
            <p className="text-xl font-semibold">{data.metrics.unplayedTracks}</p>
            <Link href="/?tab=library&libraryView=needs-review" className="text-xs text-[var(--color-accent)] hover:underline">
              Open in library
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <History className="h-3.5 w-3.5" />
              Played
            </p>
            <p className="text-xl font-semibold">{data.metrics.playedItems}</p>
            <Link href="/?tab=library&libraryView=history" className="text-xs text-[var(--color-accent)] hover:underline">
              Open in library
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reviewed
            </p>
            <p className="text-xl font-semibold">{data.metrics.doneTracks}</p>
            <Link href="/?tab=library&libraryView=reviewed" className="text-xs text-[var(--color-accent)] hover:underline">
              Open in library
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <Heart className="h-3.5 w-3.5" />
              Saved Tracks
            </p>
            <p className="text-xl font-semibold">{data.metrics.savedTracks}</p>
            <Link href="/?tab=library&libraryView=library" className="text-xs text-[var(--color-accent)] hover:underline">
              Open in library
            </Link>
          </CardContent>
        </Card>
        </div>
      </section>
      ) : null}

      {hasYoutubeBlockedError ? (
        <section className="mb-5 reveal reveal-delay-1">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="font-medium">YouTube key is blocked for search.list.</p>
            <p className="mt-1">Open Settings and use the YouTube Block Fix Assistant to resolve it in order.</p>
            <Link href="/settings#youtube-fix" className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline">
              Open YouTube Block Fix Assistant
            </Link>
          </div>
        </section>
      ) : null}

      {activeTab === "step-1" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
          <Card>
            <CardHeader>
              <CardTitle>Source Intake & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canProcess ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="text-amber-200">
                    {hasYoutubeBlockedError
                      ? "YouTube key is blocked. Processing still works via Discogs release videos where available."
                      : "Connect Discogs to enable ingestion. YouTube is an optional fallback for releases without Discogs videos."}
                  </p>
                  <Link href="/connect-discogs?next=/" className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline">Connect Discogs</Link>
                </div>
              ) : null}

              <form action={addSourceAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input id="label-input" name="source" placeholder="Paste Discogs source URL, ID, or name (label or artist)" required />
                <FormSubmitButton type="submit" pendingText="Adding...">Add Source</FormSubmitButton>
              </form>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 p-2.5 text-xs text-[var(--color-muted)]">
                <p><span className="font-medium text-[var(--color-text)]">Label source:</span> pull from a label catalog for tighter stylistic consistency.</p>
                <p className="mt-1"><span className="font-medium text-[var(--color-text)]">Artist source:</span> follow a producer across multiple labels/releases for broader discovery.</p>
              </div>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Ingestion Pipeline</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>Processing {activeStatusCounts.processing}</Badge>
                  <Badge>Queued {activeStatusCounts.queued}</Badge>
                  <Badge className={activeStatusCounts.error > 0 ? "border-rose-500/50 bg-rose-500/15 text-rose-200" : ""}>Errored {activeStatusCounts.error}</Badge>
                  <Badge>Complete {activeStatusCounts.complete}</Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  These Processing/Queued counts are source ingestion jobs (labels/artists), not wishlist sync.
                </p>
                <details className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)]/70 p-2.5 text-xs">
                  <summary className="cursor-pointer select-none text-[var(--color-text)]">
                    {activeStatusCounts.processing > 0
                      ? `Auto-sync is running on this page (${activeStatusCounts.processing} active source ${activeStatusCounts.processing === 1 ? "job" : "jobs"}).`
                      : "Auto-sync is idle right now on this page."}
                  </summary>
                  <div className="mt-2">
                    {processingSourceNames.length > 0 ? (
                      <p className="text-[var(--color-muted)]">Currently processing: {processingSourceNames.join(", ")}</p>
                    ) : null}
                    {processingSourceProgress.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {processingSourceProgress.map((source) => (
                          <p key={source.id} className="text-[var(--color-muted)]">
                            {source.name}: page {source.currentPage}/{source.totalPages}, releases {source.fetchedReleaseCount}/{source.loadedReleaseCount} fetched
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {syncTelemetry ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[var(--color-text)]">
                          Now syncing: {syncTelemetry.sourceName} ({syncTelemetry.sourceKind})
                        </p>
                        {syncTelemetry.message ? (
                          <p className="text-[var(--color-muted)]">{syncTelemetry.message}</p>
                        ) : null}
                        {syncTelemetry.releaseTitle ? (
                          <p className="text-[var(--color-muted)]">Release: {syncTelemetry.releaseTitle}</p>
                        ) : null}
                        {syncTelemetry.trackTitle ? (
                          <p className="text-[var(--color-muted)]">
                            Track now: {syncTelemetry.trackTitle}
                            {typeof syncTelemetry.trackIndex === "number" && typeof syncTelemetry.trackTotal === "number"
                              ? ` (${syncTelemetry.trackIndex}/${syncTelemetry.trackTotal})`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>
                {hasDiscogs ? (
                  <WishlistSyncStatus initialStatus={wantsSyncStatus} />
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Connect Discogs to enable wishlist sync status.</p>
                )}
              </div>
              <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3" open={!useSimpleSourcesView}>
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  Advanced options
                </summary>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href={filterHref("all")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedLabelState === "all"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show all loaded sources"
                      >
                        All ({queriedLabels.length})
                      </Link>
                      <Link
                        href={filterHref("active")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedLabelState === "active"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show only active sources used for listening"
                      >
                        Active ({activeFilteredCount})
                      </Link>
                      <Link
                        href={filterHref("inactive")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedLabelState === "inactive"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show sources currently excluded from processing"
                      >
                        Inactive ({inactiveFilteredCount})
                      </Link>
                      <Link
                        href={kindHref("all")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedSourceKind === "all"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show all source kinds"
                      >
                        Any Kind ({queriedLabels.length})
                      </Link>
                      <Link
                        href={kindHref("label")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedSourceKind === "label"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show label sources only"
                      >
                        Label Sources ({queriedLabels.filter((item) => item.entityKind !== "artist").length})
                      </Link>
                      <Link
                        href={kindHref("artist")}
                        className={`inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-sm ${
                          selectedSourceKind === "artist"
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        }`}
                        title="Show artist sources only"
                      >
                        Artists ({queriedLabels.filter((item) => item.entityKind === "artist").length})
                      </Link>
                    </div>
                    <form method="GET" className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="tab" value="step-1" />
                      {listenLabel ? <input type="hidden" name="listenLabel" value={listenLabel} /> : null}
                      {selectedLabelState !== "all" ? <input type="hidden" name="labelState" value={selectedLabelState} /> : null}
                      {selectedSourceKind !== "all" ? <input type="hidden" name="sourceKind" value={selectedSourceKind} /> : null}
                      <Input
                        name="labelQuery"
                        defaultValue={labelQuery || ""}
                        placeholder="Search sources by name, summary, release tags"
                        className="w-full sm:max-w-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">Search</Button>
                      {normalizedLabelQuery ? (
                        <Link
                          href={clearSearchHref}
                          className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        >
                          Clear
                        </Link>
                      ) : null}
                    </form>
                  </div>
                  <div className="min-w-0">
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={refreshMissingLabelMetadataAction}>
                        <FormSubmitButton type="submit" size="sm" variant="outline" pendingText="Refreshing..." title="Fetch profile and artwork for sources missing metadata">
                          Refresh missing source info
                        </FormSubmitButton>
                      </form>
                      {hasDiscogs ? (
                        <form action={pullDiscogsWantsAction}>
                          <FormSubmitButton
                            type="submit"
                            size="sm"
                            variant="secondary"
                            pendingText="Importing..."
                            title="Imports your most recent 200 Discogs wants into Library. Does not auto-activate sources."
                          >
                            Import Recent Wishlist (200)
                          </FormSubmitButton>
                        </form>
                      ) : (
                        <Link href="/connect-discogs?next=/" className="text-xs text-[var(--color-accent)] hover:underline">
                          Connect Discogs to pull wishlist
                        </Link>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      Imports recent wants into Library for review. It does not auto-activate queue sources.
                    </p>
                  </div>
                </div>
              </details>

              <div className="space-y-2">
                {filteredLabels.map((label) => {
                  const visibleLastError = getVisibleLabelError(label.lastError);
                  const normalizedStatusRaw = normalizeLabelStatus(Boolean(label.active), label.status, label.lastError);
                  const normalizedStatus = label.tracksFullyLoaded ? "complete" : normalizedStatusRaw;
                  const totalLoadedReleases = Math.max(0, label.loadedReleaseCount);
                  const fetchedReleases = Math.max(0, label.fetchedReleaseCount);
                  const progressPct = totalLoadedReleases > 0
                    ? Math.min(100, Math.round((fetchedReleases / totalLoadedReleases) * 100))
                    : 0;
                  const statusLabel =
                    normalizedStatus === "processing"
                      ? "Processing"
                      : normalizedStatus === "queued"
                        ? "Queued"
                        : normalizedStatus === "error"
                          ? "Error"
                          : normalizedStatus === "paused"
                            ? "Paused"
                          : normalizedStatus === "complete"
                            ? "Complete"
                            : normalizedStatus;
                  return (
                    <div
                    key={label.id}
                    className={`rounded-xl border p-3 transition ${
                      label.active
                        ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.22)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface2)] opacity-90"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        {label.imageUrl ? (
                          <img
                            src={label.imageUrl}
                            alt={`${label.name} source`}
                            className={`h-14 w-14 rounded-md border object-cover ${label.active ? "border-emerald-500/40" : "border-[var(--color-border)]"}`}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={`h-14 w-14 rounded-md border bg-[var(--color-surface)] ${label.active ? "border-emerald-500/40" : "border-[var(--color-border)]"}`}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <Link href={`/labels/${label.id}`} className="line-clamp-1 text-sm font-medium hover:text-[var(--color-accent)]">{label.name}</Link>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {fetchedReleases}/{totalLoadedReleases} releases • {progressPct}% • {label.loadedTrackCount} tracks
                          </p>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
                            <div
                              className={`h-full transition-all ${normalizedStatus === "error" ? "bg-rose-400/80" : "bg-emerald-400/80"}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="border-[var(--color-border)] text-[10px] uppercase">
                          {label.entityKind === "artist" ? "Artist" : "Label"}
                        </Badge>
                        {label.active ? (
                          <Badge className="border-emerald-500/70 bg-emerald-500/15 text-emerald-200">ACTIVE</Badge>
                        ) : (
                          <Badge className="border-zinc-600/40 text-zinc-400">inactive</Badge>
                        )}
                        <Badge className={normalizedStatus === "error" ? "border-rose-500/60 text-rose-200" : ""}>{statusLabel}</Badge>
                      </div>
                    </div>
                    {visibleLastError ? <p className="mt-2 line-clamp-2 text-xs text-red-300">Error: {visibleLastError}</p> : null}
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                          href={toDiscogsWebUrl(label.discogsUrl, "")}
                          target="_blank"
                          rel="noreferrer"
                          title="Open on Discogs"
                          aria-label="Open on Discogs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {!label.tracksFullyLoaded ? (
                          <form action={retryLabelAction}>
                            <input type="hidden" name="labelId" value={label.id} />
                            <FormSubmitButton
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={!canProcess || normalizedStatus === "processing"}
                              pendingText="Running step..."
                              title="Run one immediate ingestion step for this source"
                            >
                              {normalizedStatus === "processing" ? "Syncing..." : normalizedStatus === "queued" ? "Queued..." : "Run one step"}
                            </FormSubmitButton>
                          </form>
                        ) : null}
                        <p className="text-xs text-[var(--color-muted)]">
                          Updated {new Date(label.updatedAt).toLocaleDateString()} • Retries {label.retryCount}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ProcessingToggle
                          key={`${label.id}-${label.active ? "1" : "0"}-${label.status}`}
                          labelId={label.id}
                          initialActive={Boolean(label.active)}
                          initialStatus={label.status}
                          disabled={!canProcess}
                        />
                      </div>
                    </div>
                    <details className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 px-2.5 py-2 text-xs text-[var(--color-muted)]">
                      <summary className="cursor-pointer select-none text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                        Details
                      </summary>
                      <p className="mt-2 line-clamp-2">{label.summaryText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <form action={refreshLabelMetadataAction}>
                          <input type="hidden" name="labelId" value={label.id} />
                          <FormSubmitButton type="submit" size="sm" variant="ghost" pendingText="Refreshing..." title="Refresh this source profile, image, and notable releases">
                            <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                            Refresh source info
                          </FormSubmitButton>
                        </form>
                        <LabelDeleteButton labelId={label.id} labelName={label.name} />
                      </div>
                      {label.notableReleasesJson !== "[]" ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(() => {
                            try {
                              const entries = JSON.parse(label.notableReleasesJson) as string[];
                              return entries.slice(0, 4).map((entry) => <Badge key={`${label.id}-${entry}`}>{entry}</Badge>);
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      ) : null}
                    </details>
                  </div>
                  );
                })}
                {filteredLabels.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="text-sm text-[var(--color-muted)]">No sources match this filter.</p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <p className="text-sm font-medium">
                    {data.labels.length === 0 ? "No sources yet." : "Want more sources?"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Import recent Discogs wants from the Actions panel to review them in Library.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
      </section>
      ) : null}

      {activeTab === "step-2" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-12 reveal reveal-delay-2">
          <Card className="xl:col-span-12">
            <CardHeader>
              <CardTitle>Queue Workbench</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className={data.metrics.labelsErrored > 0 ? "border-rose-500/50 bg-rose-500/15 text-rose-200" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"}>
                  Errors {data.metrics.labelsErrored}
                </Badge>
                <Badge className={data.metrics.releasesLowConfidence > 0 ? "border-amber-500/50 bg-amber-500/15 text-amber-200" : ""}>
                  Low Conf {data.metrics.releasesLowConfidence}
                </Badge>
                <Badge>Up Next {data.queueCount}</Badge>
              </div>

              {data.erroredLabels.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--color-muted)]">
                    <p className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {data.erroredLabels.length} active {data.erroredLabels.length === 1 ? "source errored" : "sources errored"}.
                    </p>
                    <form action={retryErroredLabelsAction}>
                      <FormSubmitButton
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        pendingText="Clearing..."
                        title="Clear error state on all active errored sources; does not run processing"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Clear all flags
                      </FormSubmitButton>
                    </form>
                  </div>
                  <p className="text-[10px] text-[var(--color-muted)]">Retry runs one processing step for one source and can still fail if API/database limits are hit.</p>
                  <div className="divide-y divide-[color-mix(in_oklab,var(--color-border)_70%,transparent)] rounded-md border border-[color-mix(in_oklab,var(--color-border)_60%,transparent)]">
                    {data.erroredLabels.slice(0, 5).map((label) => {
                      const visibleLastError = getVisibleLabelError(label.lastError);
                      return (
                        <div key={label.id} className="flex flex-wrap items-start justify-between gap-2 px-2 py-2">
                          <div className="min-w-0">
                            <Link href={`/labels/${label.id}`} className="line-clamp-1 text-xs font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                              {label.name}
                            </Link>
                            <p className="text-[10px] text-[var(--color-muted)]">
                              Last attempt {new Date(label.updatedAt).toLocaleString()} • Retries {label.retryCount}
                            </p>
                            {visibleLastError ? <p className="line-clamp-2 text-[11px] text-[var(--color-muted)]">{visibleLastError}</p> : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/labels/${label.id}`}>
                              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Open source">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                            <form action={retryLabelAction}>
                              <input type="hidden" name="labelId" value={label.id} />
                              <FormSubmitButton
                                type="submit"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                pendingText="Retrying now..."
                                title="Run one immediate processing step for this source"
                              >
                                Retry
                              </FormSubmitButton>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <ListenInboxClient
                initialRows={listenData?.rows ?? []}
                initialSelectedLabelId={Number.isFinite(selectedListenLabelId) ? selectedListenLabelId : undefined}
                labelOptions={activeLabels.map((label) => ({
                  id: label.id,
                  name: label.name,
                  discogsUrl: label.discogsUrl,
                }))}
                defaultHideAlreadyPlayed={false}
              />
            </CardContent>
          </Card>
      </section>
      ) : null}

      {activeTab === "library" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Library Views</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={libraryViewHref("library")}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                    selectedLibraryView === "library"
                      ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  }`}
                  title="Saved tracks and wishlisted records"
                >
                  <Bookmark className="h-4 w-4" />
                  Library
                </Link>
                <Link
                  href={libraryViewHref("history")}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                    selectedLibraryView === "history"
                      ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  }`}
                  title="Tracks that have been played"
                >
                  <History className="h-4 w-4" />
                  History
                </Link>
                <Link
                  href={libraryViewHref("reviewed")}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                    selectedLibraryView === "reviewed"
                      ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  }`}
                  title="Tracks marked reviewed"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Reviewed
                </Link>
                <Link
                  href={libraryViewHref("needs-review")}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                    selectedLibraryView === "needs-review"
                      ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_20%,var(--color-surface)_80%)] text-[var(--color-text)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  }`}
                  title="Played tracks still waiting for review"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Needs Review
                </Link>
              </div>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Actions</p>
                {showLibraryItemsSection && hasDiscogs ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={pullDiscogsWantsAction}>
                    <FormSubmitButton
                      type="submit"
                      size="sm"
                      variant="outline"
                      pendingText="Importing..."
                      title="Imports your most recent 200 Discogs wants into Library. Does not auto-activate sources."
                    >
                      Import Recent Wants (200)
                    </FormSubmitButton>
                  </form>
                  <SyncSavedToDiscogsButton enabled={hasDiscogs} />
                  </div>
                ) : showLibraryItemsSection ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">Connect Discogs to sync wants.</p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">No actions for this view.</p>
                )}
                {showLibraryItemsSection ? (
                  <div className="mt-2">
                    {hasDiscogs ? (
                      <div>
                        <WishlistSyncStatus initialStatus={wantsSyncStatus} />
                        <form action={pullDiscogsWantsAction} className="mt-2">
                          <FormSubmitButton type="submit" size="sm" variant="outline" pendingText="Retrying...">
                            Retry wishlist sync now
                          </FormSubmitButton>
                        </form>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">Connect Discogs to enable wishlist sync.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {showLibraryItemsSection ? <Badge>Saved Tracks {totalSavedCount}</Badge> : null}
              <Badge>Wishlisted Records {totalWishlistedRecords}</Badge>
              {selectedLibraryView === "history" ? <Badge>History Items {historyCount}</Badge> : null}
              {selectedLibraryView === "reviewed" ? <Badge>Reviewed Items {reviewedCount}</Badge> : null}
              {selectedLibraryView === "needs-review" ? <Badge>Needs Review {needsReviewCount}</Badge> : null}
            </div>
          </div>

          {showLibraryItemsSection ? (
            <Card>
              <CardHeader>
                <CardTitle>Library Items</CardTitle>
                <p className="text-xs text-[var(--color-muted)]">Use filters to separate saved tracks and wishlisted-record items.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ListenInboxClient
                  initialRows={libraryRows}
                  initialSelectedLabelId={Number.isFinite(selectedListenLabelId) ? selectedListenLabelId : undefined}
                  labelOptions={activeLabels.map((label) => ({
                    id: label.id,
                    name: label.name,
                    discogsUrl: label.discogsUrl,
                  }))}
                  showQueueFilters={false}
                  showWishlistSourceFilter
                />

                <YoutubePlaylistExportButton
                  oauthConfigured={youtubeOAuth.configured}
                  youtubeConnected={youtubeOAuth.connected}
                  eligibleSavedCount={playableSavedCount}
                  channelTitle={youtubeOAuth.channelTitle}
                  connectHref="/api/youtube/oauth/start?next=/?tab=library&libraryView=library"
                />

                {bandcampWishlist.enabled ? (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Previous Bandcamp Wishlist ({bandcampWishlist.totalCount})
                        {bandcampWishlist.partial ? " (partial)" : ""}
                      </p>
                      {bandcampWishlist.sourceUrl ? (
                        <a className="text-xs text-[var(--color-accent)] hover:underline" href={bandcampWishlist.sourceUrl} target="_blank" rel="noreferrer">
                          Open on Bandcamp
                        </a>
                      ) : null}
                    </div>
                    {bandcampWishlist.items.length > 0 ? (
                      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                        {bandcampWishlist.items.map((item) => (
                          <a
                            key={`${item.type}-${item.id}-${item.url}`}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-surface)]"
                          >
                            <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-[var(--color-muted)]">
                              {item.bandName} • {item.type}
                            </p>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">
                        No Bandcamp wishlist items loaded. Set <span className="mono">BANDCAMP_WISHLIST_URL</span> in your env to enable this.
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {showPlayedReviewedSection ? (
            <Card>
            <CardHeader>
              <CardTitle>
                {selectedLibraryView === "reviewed"
                  ? `Reviewed (${reviewedCount})`
                  : selectedLibraryView === "needs-review"
                    ? `Needs Review (${needsReviewCount})`
                    : `History (${historyCount})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Current Loaded Sources Activity</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {selectedLibraryView === "reviewed"
                    ? "Tracks you explicitly marked reviewed."
                    : selectedLibraryView === "needs-review"
                      ? "Tracks that were played but still are not marked reviewed."
                      : "Tracks that have been played at least once."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                  <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <History className="h-3.5 w-3.5" />
                    Played Events
                  </p>
                  <p className="text-xl font-semibold">{data.metrics.playedItems}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                  <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reviewed Tracks
                  </p>
                  <p className="text-xl font-semibold">{data.metrics.doneTracks}</p>
                </div>
              </div>

              <ListenInboxClient
                initialRows={
                  selectedLibraryView === "reviewed"
                    ? reviewedRows
                    : selectedLibraryView === "needs-review"
                      ? needsReviewRows
                      : historyRows
                }
                initialSelectedLabelId={Number.isFinite(selectedListenLabelId) ? selectedListenLabelId : undefined}
                labelOptions={activeLabels.map((label) => ({
                  id: label.id,
                  name: label.name,
                  discogsUrl: label.discogsUrl,
                }))}
                defaultHideReviewed={false}
                defaultHideAlreadyPlayed={false}
              />
            </CardContent>
            </Card>
          ) : null}
      </section>
      ) : null}

      {activeTab === "recommendations" ? (
      <section className="mt-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
        <Card>
          <CardHeader>
            <CardTitle>Recommendation Inbox ({data.recommendations.length + data.externalRecommendations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <RecommendationsPanel initialItems={data.recommendations} externalItems={data.externalRecommendations} />
          </CardContent>
        </Card>
      </section>
      ) : null}
    </main>
  );
}
