export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
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
import { ClientRouteRefreshBridge } from "@/components/client-route-refresh-bridge";
import { DiscogsRequiredNotice } from "@/components/discogs-required-notice";
import { FeedbackBanner } from "@/components/feedback-banner";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { DiscogsLink } from "@/components/discogs-link";
import { LabelDeleteButton } from "@/components/label-delete-button";
import { ListenInboxClient } from "@/components/listen-inbox-client";
import { ManualWishlistSyncButton } from "@/components/manual-wishlist-sync-button";
import { OnboardingStatusCard } from "@/components/onboarding-status-card";
import { ExternalLinkRow } from "@/components/external-link-row";
import { ProcessingToggle } from "@/components/processing-toggle";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { SegmentedControlLink } from "@/components/segmented-control-button";
import { SourceRemediationButton } from "@/components/source-remediation-button";
import { SourceIntakeForm } from "@/components/source-intake-form";
import { SourceRefreshButton } from "@/components/source-refresh-button";
import { SourceRetryButton } from "@/components/source-retry-button";
import { SourceSyncControlButton } from "@/components/source-sync-control-button";
import { SyncSavedToDiscogsButton } from "@/components/sync-saved-to-discogs-button";
import { SourceSyncStatus } from "@/components/source-sync-status";
import { YoutubePlaylistExportButton } from "@/components/youtube-playlist-export-button";
import { WishlistSyncStatus } from "@/components/wishlist-sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { getBandcampWishlistData } from "@/lib/bandcamp-wishlist";
import {
  getLibraryItemsEmptyState,
  getListeningEmptyState,
  getReviewedEmptyState,
} from "@/lib/dashboard-empty-states";
import { getDiscogsWantsSyncStatus } from "@/lib/discogs-wants-sync";
import { getOnboardingSnapshot } from "@/lib/onboarding-snapshot";
import { getDashboardData, getPlayedReviewedData, getToListenData, getWishlistData } from "@/lib/queries";
import { resolveSourceDisplayName } from "@/lib/source-display";
import { getSourceKindLabel, toSourceKind } from "@/lib/source-kind";
import {
  getFailureCategoryMeta,
  groupSourceFailuresByCategory,
  summarizeFailureProviders,
  summarizeFailureSourceKinds,
} from "@/lib/source-failures";
import { getEffectiveSourceStatus, getSourceViewModel, getSourceVisibleError } from "@/lib/source-view";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    listenLabel?: string;
    tab?: string;
    labelState?: string;
    sourceKind?: string;
    labelQuery?: string;
    libraryView?: string;
    notice?: string;
    source?: string;
    remAction?: string;
    remScope?: string;
    remAffected?: string;
    remFailed?: string;
    remCategory?: string;
    remSourceCount?: string;
    remSourcePreview?: string;
  }>;
}) {
  await requireCurrentAppUserId();
  const {
    listenLabel,
    tab,
    labelState,
    sourceKind,
    labelQuery,
    libraryView,
    notice,
    source,
    remAction,
    remScope,
    remAffected,
    remFailed,
    remCategory,
    remSourceCount,
    remSourcePreview,
  } = await searchParams;
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
  const showWishlistHeaderPill = hasDiscogs && activeTab === "recommendations";
  const hasAnySources = data.labels.length > 0;

  const isLabelsTab = activeTab === "step-1";
  const canProcess = hasDiscogs;
  const useSimpleSourcesView = data.labels.length <= 3 && !normalizedLabelQuery && selectedLabelState === "all" && selectedSourceKind === "all";
  const activeLabels = data.labels.filter((label) => label.active);
  const activeStatusCounts = activeLabels.reduce(
    (acc, label) => {
      const effective = getEffectiveSourceStatus({
        active: Boolean(label.active),
        status: label.status,
        lastError: label.lastError,
        tracksFullyLoaded: label.tracksFullyLoaded,
      });
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
  const queuedSources = activeLabels
    .filter((label) => {
      return getEffectiveSourceStatus({
        active: Boolean(label.active),
        status: label.status,
        lastError: label.lastError,
        tracksFullyLoaded: label.tracksFullyLoaded,
      }) === "queued";
    })
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const nextQueuedSource = queuedSources[0] ?? null;
  const queuedPreviewNames = queuedSources.slice(0, 3).map((label) =>
    resolveSourceDisplayName({
      name: label.name,
      discogsUrl: label.discogsUrl,
      kind: toSourceKind(label.entityKind),
      externalDiscogsId: label.externalDiscogsId,
    }),
  );
  const pausedSourceCount = data.labels.filter((label) => !label.active && label.status === "paused").length;
  const retryableActiveSourceCount = activeLabels.filter((label) => label.status === "error").length;
  const showIngestionPanelOpen =
    activeStatusCounts.processing > 0 || activeStatusCounts.error > 0 || retryableActiveSourceCount > 0;
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
  const labelSources = filteredLabels.filter((label) => label.entityKind !== "artist");
  const artistSources = filteredLabels.filter((label) => label.entityKind === "artist");
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
  const failureCenterNextHref = (() => {
    const params = new URLSearchParams();
    params.set("tab", "step-2");
    if (listenLabel) params.set("listenLabel", listenLabel);
    return `/?${params.toString()}`;
  })();
  const remediationAffectedCount = Number(remAffected);
  const remediationFailedCount = Number(remFailed);
  const remediationSourceCount = Number(remSourceCount);
  const remediationHasFailures = Number.isFinite(remediationFailedCount) && remediationFailedCount > 0;
  const remediationHasSources = Number.isFinite(remediationSourceCount) && remediationSourceCount > 0;
  const showRemediationSummary =
    activeTab === "step-2" &&
    Boolean(remAction) &&
    Boolean(remScope) &&
    Number.isFinite(remediationAffectedCount) &&
    remediationAffectedCount >= 0;
  const remediationChanged = remediationAffectedCount > 0;
  const libraryRows = wishlistData?.rows ?? [];
  const historyRows = [...(playedReviewedData?.rows ?? [])]
    .filter((row) => (row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed))
    .sort((a, b) => {
      const aLast = typeof a.lastPlayedQueueId === "number" ? a.lastPlayedQueueId : 0;
      const bLast = typeof b.lastPlayedQueueId === "number" ? b.lastPlayedQueueId : 0;
      if (bLast !== aLast) return bLast - aLast;
      return b.trackId - a.trackId;
    });
  const reviewedRows = (playedReviewedData?.rows ?? []).filter((row) => row.listened);
  const needsReviewRows = (playedReviewedData?.rows ?? []).filter(
    (row) => !row.listened && ((row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed)),
  );
  const totalSavedCount = libraryRows.length;
  const playableSavedCount = libraryRows.filter((row) => row.saved && Boolean(row.youtubeVideoId)).length;
  const onboardingSnapshot = await getOnboardingSnapshot();
  const youtubeOAuthConfigured = onboardingSnapshot?.youtubeOAuthConfigured ?? false;
  const youtubeOAuthConnected = onboardingSnapshot?.youtubeOAuthConnected ?? false;
  const youtubeChannelTitle = onboardingSnapshot?.youtubeChannelTitle ?? null;
  const historyCount = historyRows.length;
  const reviewedCount = reviewedRows.length;
  const needsReviewCount = needsReviewRows.length;
  const totalWishlistedRecords = data.metrics.wishlistedRecords;
  const failureGroups = groupSourceFailuresByCategory(data.erroredLabels, (label) => getSourceVisibleError(label.lastError) || "Unknown source failure.");
  const failureCategorySummary = failureGroups.map((group) => ({
    category: group.category,
    count: group.items.length,
    meta: getFailureCategoryMeta(group.category),
  }));
  const failureKindSummary = summarizeFailureSourceKinds(
    data.erroredLabels,
    (label) => toSourceKind(label.entityKind),
  );
  const failureProviderSummary = summarizeFailureProviders(
    data.erroredLabels,
    (label) => getSourceVisibleError(label.lastError) || "",
  );
  const activeSourceCount = data.labels.filter((label) => label.active).length;
  const onboardingHealth = onboardingSnapshot?.health ?? null;
  const showOnboarding = onboardingHealth ? onboardingHealth.tone !== "ready" : false;
  const listeningEmptyState = getListeningEmptyState({
    discogsConnected: hasDiscogs,
    activeSourceCount: activeLabels.length,
    listeningRowCount: listenData?.rows?.length ?? 0,
  });
  const libraryItemsEmptyState = getLibraryItemsEmptyState({
    discogsConnected: hasDiscogs,
    savedCount: totalSavedCount,
    wishlistedRecordCount: totalWishlistedRecords,
  });
  const reviewedEmptyState = getReviewedEmptyState({
    selectedLibraryView:
      selectedLibraryView === "library" ? "history" : selectedLibraryView,
  });
  const renderSourceCard = (label: (typeof data.labels)[number]) => {
    const displayName = resolveSourceDisplayName({
      name: label.name,
      discogsUrl: label.discogsUrl,
      kind: toSourceKind(label.entityKind),
      externalDiscogsId: label.externalDiscogsId,
    });
    const sourceView = getSourceViewModel({
      active: Boolean(label.active),
      status: label.status,
      lastError: label.lastError,
      tracksFullyLoaded: label.tracksFullyLoaded,
    });
    const totalLoadedReleases = Math.max(0, label.loadedReleaseCount);
    const fetchedReleases = Math.max(0, label.fetchedReleaseCount);
    const progressPct = totalLoadedReleases > 0 ? Math.min(100, Math.round((fetchedReleases / totalLoadedReleases) * 100)) : 0;
    const needsSourceInfoRefresh = !label.imageUrl || !label.blurb || label.notableReleasesJson === "[]";
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
              <Image
                src={label.imageUrl}
                alt={`${label.name} source`}
                width={56}
                height={56}
                className={`h-14 w-14 rounded-md border object-cover ${label.active ? "border-emerald-500/40" : "border-[var(--color-border)]"}`}
              />
            ) : (
              <div
                className={`h-14 w-14 rounded-md border bg-[var(--color-surface)] ${label.active ? "border-emerald-500/40" : "border-[var(--color-border)]"}`}
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <Link href={`/labels/${label.id}`} className="line-clamp-1 text-sm font-medium hover:text-[var(--color-accent)]">{displayName}</Link>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {fetchedReleases}/{totalLoadedReleases} rel • {progressPct}% • {label.loadedTrackCount} tracks
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
                <div
                  className={`h-full transition-all ${sourceView.effectiveStatus === "error" ? "bg-rose-400/80" : "bg-emerald-400/80"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className="border-[var(--color-border)] text-[10px] uppercase">{getSourceKindLabel(label.entityKind)}</Badge>
            {label.active ? (
              <Badge className="border-emerald-500/70 bg-emerald-500/15 text-emerald-200">ACTIVE</Badge>
            ) : (
              <Badge className="border-zinc-600/40 text-zinc-400">inactive</Badge>
            )}
            <Badge className={sourceView.effectiveStatus === "error" ? "border-rose-500/60 text-rose-200" : ""}>{sourceView.statusLabel}</Badge>
          </div>
        </div>
        {sourceView.visibleError ? <p className="mt-2 line-clamp-2 text-xs text-red-300">Error: {sourceView.visibleError}</p> : null}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DiscogsLink discogsUrl={label.discogsUrl} title="Open on Discogs" />
            {!label.tracksFullyLoaded ? (
              <SourceRetryButton
                labelId={label.id}
                canProcess={canProcess}
                processing={sourceView.effectiveStatus === "processing"}
                queued={sourceView.effectiveStatus === "queued"}
              />
            ) : null}
            <p className="text-xs text-[var(--color-muted)]">
              Updated {new Date(label.updatedAt).toLocaleDateString()} • Retry {label.retryCount}
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
          <summary className="cursor-pointer select-none text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted)]">Details</summary>
          <p className="mt-2 line-clamp-2">{label.summaryText}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {needsSourceInfoRefresh ? <SourceRefreshButton labelId={label.id} /> : null}
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
  };
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
      <ClientRouteRefreshBridge />
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
          {onboardingSnapshot ? (
            <OnboardingStatusCard
              snapshot={onboardingSnapshot}
              title="What To Do Next"
              className="border-[var(--color-border)] bg-[var(--color-surface2)]"
              actionVariant="default"
              actionSize="default"
              extraActions={
                <>
                  {hasDiscogs && !hasAnySources ? <ManualWishlistSyncButton enabled importLabel /> : null}
                  <Link href="/how-to-use">
                    <Button type="button" variant="ghost">How to use</Button>
                  </Link>
                </>
              }
            />
          ) : null}
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
          <FeedbackBanner
            tone="warning"
            className="p-3"
            title="YouTube key is blocked for search.list."
            action={(
              <Link href="/settings#youtube-fix" className="inline-block text-xs text-[var(--color-accent)] hover:underline">
                Open YouTube Block Fix Assistant
              </Link>
            )}
          >
            <p>Open Settings and use the YouTube Block Fix Assistant to resolve it in order.</p>
          </FeedbackBanner>
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
                hasYoutubeBlockedError ? (
                  <FeedbackBanner tone="warning" className="p-3">
                    YouTube key is blocked. Processing still works via Discogs release videos where available.
                  </FeedbackBanner>
                ) : (
                  <DiscogsRequiredNotice context="ingestion" />
                )
              ) : null}
              {notice ? (
                <FeedbackBanner tone="success" className="p-3">
                  {notice}
                  {source ? <span className="ml-1 text-emerald-100">- {source}</span> : null}
                </FeedbackBanner>
              ) : null}

              <SourceIntakeForm />
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 p-2.5 text-xs text-[var(--color-muted)]">
                <p><span className="font-medium text-[var(--color-text)]">Label:</span> tighter label-led digging.</p>
                <p className="mt-1"><span className="font-medium text-[var(--color-text)]">Artist:</span> broader cross-label discovery.</p>
              </div>
              <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 p-2.5" open={showIngestionPanelOpen}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Sync</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {activeStatusCounts.processing > 0
                          ? "Sync is active."
                          : activeStatusCounts.queued > 0
                            ? "Sync is queued and will start shortly."
                          : "Sync is idle."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className={activeStatusCounts.processing > 0 ? "border-sky-500/60 bg-sky-500/15 text-sky-200" : ""}>
                        {activeStatusCounts.processing > 0 ? "Running" : "Idle"} {activeStatusCounts.processing}
                      </Badge>
                      <Badge>Queued {activeStatusCounts.queued}</Badge>
                      <Badge className={activeStatusCounts.error > 0 ? "border-rose-500/50 bg-rose-500/15 text-rose-200" : ""}>
                        Errors {activeStatusCounts.error}
                      </Badge>
                      <Badge className={activeStatusCounts.complete > 0 ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-200" : ""}>
                        Complete {activeStatusCounts.complete}
                      </Badge>
                    </div>
                  </div>
                </summary>
                <div className="mt-2 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {activeStatusCounts.processing > 0 || activeStatusCounts.queued > 0 ? (
                    <SourceSyncControlButton
                      action="pause"
                      compact
                      variant="secondary"
                      title="Pause source sync."
                      disabled={!canProcess || activeLabels.length <= 0}
                    />
                  ) : (
                    <SourceSyncControlButton
                      action="start"
                      compact
                      variant="secondary"
                      title="Resume paused sources and queue active sources."
                      disabled={!canProcess || (activeLabels.length <= 0 && pausedSourceCount <= 0)}
                    />
                  )}
                  {activeStatusCounts.error > 0 ? (
                    <SourceSyncControlButton
                      action="retry_errors"
                      compact
                      variant="outline"
                      title="Move errored sources back to queue."
                      disabled={!canProcess}
                    />
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span>Source sync only.</span>
                  {hasDiscogs ? <WishlistSyncStatus initialStatus={wantsSyncStatus} compact /> : null}
                </div>
                {nextQueuedSource && activeStatusCounts.processing === 0 ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Next: {resolveSourceDisplayName({
                      name: nextQueuedSource.name,
                      discogsUrl: nextQueuedSource.discogsUrl,
                      kind: toSourceKind(nextQueuedSource.entityKind),
                      externalDiscogsId: nextQueuedSource.externalDiscogsId,
                    })} (1/{activeStatusCounts.queued})
                    {queuedPreviewNames.length > 1 ? ` • Then ${queuedPreviewNames.slice(1).join(", ")}` : ""}
                  </p>
                ) : null}
                <SourceSyncStatus initialProcessingCount={activeStatusCounts.processing} />
                {!hasDiscogs ? <div className="mt-1"><DiscogsRequiredNotice context="wishlist_sync_status" compact /></div> : null}
              </details>
              <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3" open={!useSimpleSourcesView}>
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  Filters
                </summary>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SegmentedControlLink active={selectedLabelState === "all"} href={filterHref("all")} title="Show all loaded sources">
                        All ({queriedLabels.length})
                      </SegmentedControlLink>
                      <SegmentedControlLink active={selectedLabelState === "active"} href={filterHref("active")} title="Show only active sources used for listening">
                        Active ({activeFilteredCount})
                      </SegmentedControlLink>
                      <SegmentedControlLink active={selectedLabelState === "inactive"} href={filterHref("inactive")} title="Show sources currently excluded from processing">
                        Inactive ({inactiveFilteredCount})
                      </SegmentedControlLink>
                      <Badge>Label sources {labelSources.length}</Badge>
                      <Badge>Artist sources {artistSources.length}</Badge>
                    </div>
                    <form method="GET" className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="tab" value="step-1" />
                      {listenLabel ? <input type="hidden" name="listenLabel" value={listenLabel} /> : null}
                      {selectedLabelState !== "all" ? <input type="hidden" name="labelState" value={selectedLabelState} /> : null}
                      {selectedSourceKind !== "all" ? <input type="hidden" name="sourceKind" value={selectedSourceKind} /> : null}
                      <Input
                        name="labelQuery"
                        defaultValue={labelQuery || ""}
                        placeholder="Search name, summary, tags"
                        className="w-full sm:max-w-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        <span className="hidden sm:inline">Search</span>
                        <span className="sm:hidden">Go</span>
                      </Button>
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
                </div>
              </details>

              <div className="space-y-4">
                {labelSources.length > 0 ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Label sources</p>
                      <Badge>{labelSources.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {labelSources.map((label) => renderSourceCard(label))}
                    </div>
                  </div>
                ) : null}
                {artistSources.length > 0 ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Artist sources</p>
                      <Badge>{artistSources.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {artistSources.map((label) => renderSourceCard(label))}
                    </div>
                  </div>
                ) : null}
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
                  {showRemediationSummary ? (
                    <p
                      className={`rounded-md border px-2 py-1.5 text-[11px] ${
                        remediationHasFailures
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          : remediationChanged
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      Ran{" "}
                      <span className={remediationChanged ? "font-medium text-emerald-50" : "font-medium text-amber-50"}>
                        {remAction}
                      </span>{" "}
                      for{" "}
                      <span className={remediationChanged ? "font-medium text-emerald-50" : "font-medium text-amber-50"}>
                        {remScope}
                      </span>{" "}
                      {remediationChanged ? "affected" : "did not change"}{" "}
                      <span
                        className={
                          remediationHasFailures
                            ? "font-medium text-amber-50"
                            : remediationChanged
                              ? "font-medium text-emerald-50"
                              : "font-medium text-amber-50"
                        }
                      >
                        {remediationAffectedCount}
                      </span>{" "}
                      item{remediationAffectedCount === 1 ? "" : "s"}
                      {remCategory ? (
                        <>
                          {" "}for <span className="font-medium uppercase tracking-[0.08em] text-[var(--color-text)]">{remCategory}</span>
                        </>
                      ) : null}
                      {remediationHasSources && remSourcePreview ? (
                        <>
                          {" "}across <span className="font-medium text-[var(--color-text)]">{remediationSourceCount}</span> source
                          {remediationSourceCount === 1 ? "" : "s"}{" "}
                          (<span className="text-[var(--color-text)]">{remSourcePreview}</span>)
                        </>
                      ) : null}
                      {remediationHasFailures ? (
                        <>
                          {" "}with{" "}
                          <span className="font-medium text-amber-50">{remediationFailedCount}</span> failure
                          {remediationFailedCount === 1 ? "" : "s"}.
                        </>
                      ) : "."}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--color-muted)]">
                    <p className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Failure Center: {data.erroredLabels.length} active error{data.erroredLabels.length === 1 ? "" : "s"}.
                    </p>
                    <SourceRemediationButton
                      action="retry_all_errors"
                      nextPath={failureCenterNextHref}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      pendingText="Clearing..."
                      title="Clear error state on all active errored sources; does not run processing"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">Clear all flags</span>
                      <span className="sm:hidden">Clear flags</span>
                    </SourceRemediationButton>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                      Labels {failureKindSummary.label}
                    </Badge>
                    <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                      Artists {failureKindSummary.artist}
                    </Badge>
                    <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                      Discogs {failureProviderSummary.discogs}
                    </Badge>
                    <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                      YouTube {failureProviderSummary.youtube}
                    </Badge>
                    {failureProviderSummary.unknown > 0 ? (
                      <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">
                        Unknown {failureProviderSummary.unknown}
                      </Badge>
                    ) : null}
                    {failureCategorySummary.map((item) => (
                      <Badge key={item.category} className={item.meta.className}>
                        {item.meta.label} {item.count}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--color-muted)]">Grouped by likely root cause with a recommended action.</p>
                  <div className="space-y-2">
                    {failureGroups.map((group, index) => {
                      const meta = getFailureCategoryMeta(group.category);
                      return (
                        <details
                          key={group.category}
                          open={index === 0}
                          className="rounded-md border border-[color-mix(in_oklab,var(--color-border)_60%,transparent)] bg-[var(--color-surface2)]/40"
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-2 py-2">
                            <span className="inline-flex items-center gap-2 text-xs font-medium">
                              <Badge className={meta.className}>{meta.label}</Badge>
                              {group.items.length} source{group.items.length === 1 ? "" : "s"}
                            </span>
                            <span className="hidden text-[11px] text-[var(--color-muted)] sm:inline">{meta.hint}</span>
                          </summary>
                          <div className="space-y-2 border-t border-[color-mix(in_oklab,var(--color-border)_55%,transparent)] px-2 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="hidden text-[11px] text-[var(--color-muted)] sm:block">{meta.hint}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <SourceRemediationButton
                                  action="retry_specific"
                                  nextPath={failureCenterNextHref}
                                  category={group.category}
                                  sourceIds={group.items.map((item) => item.label.id)}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  pendingText="Retrying..."
                                  title="Queue all sources in this failure category for retry."
                                >
                                  <span className="hidden sm:inline">Retry group</span>
                                  <span className="sm:hidden">Retry</span>
                                </SourceRemediationButton>
                                {meta.href ? (
                                  <Link href={meta.href} className="text-[11px] text-[var(--color-accent)] hover:underline">
                                    {meta.hrefLabel}
                                  </Link>
                                ) : null}
                                {group.category === "database" ? (
                                  <SourceRemediationButton
                                    action="clear_stale_locks"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Clearing..."
                                    title="Clear expired worker locks in the database."
                                  >
                                    <span className="hidden sm:inline">Clear stale locks</span>
                                    <span className="sm:hidden">Clear locks</span>
                                  </SourceRemediationButton>
                                ) : null}
                                {group.category === "rate_limit" ? (
                                  <SourceRemediationButton
                                    action="pause_all_active"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    actionLabel="pause sources for cooldown"
                                    scopeLabel="all active sources during rate-limit recovery"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Pausing..."
                                    confirmMessage={`Pause all active sources to let rate limits cool down? This will affect ${activeSourceCount} source${activeSourceCount === 1 ? "" : "s"}.`}
                                    title="Pause all active sources to let rate limits cool down."
                                  >
                                    <span className="hidden sm:inline">Pause all sources</span>
                                    <span className="sm:hidden">Pause all</span>
                                  </SourceRemediationButton>
                                ) : null}
                                {group.category === "auth" ? (
                                  <SourceRemediationButton
                                    action="pause_and_clear_specific"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    actionLabel="pause auth-blocked sources"
                                    scopeLabel="selected auth-failure group"
                                    sourceIds={group.items.map((item) => item.label.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Pausing..."
                                    confirmMessage={`Pause and clear auth errors for ${group.items.length} blocked source${group.items.length === 1 ? "" : "s"} while you reconnect Discogs?`}
                                    title="Pause these auth-blocked sources and clear their current error flags."
                                  >
                                    <span className="hidden sm:inline">Pause blocked sources</span>
                                    <span className="sm:hidden">Pause blocked</span>
                                  </SourceRemediationButton>
                                ) : null}
                                {group.category === "provider" ? (
                                  <SourceRemediationButton
                                    action="pause_and_clear_specific"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    actionLabel="cool down + clear provider errors"
                                    scopeLabel="selected provider-failure group"
                                    sourceIds={group.items.map((item) => item.label.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Pausing..."
                                    confirmMessage={`Pause ${group.items.length} provider-failed source${group.items.length === 1 ? "" : "s"} and clear their transient errors?`}
                                    title="Pause active sources and clear transient provider error flags."
                                  >
                                    <span className="hidden sm:inline">Cool down + clear errors</span>
                                    <span className="sm:hidden">Cool down</span>
                                  </SourceRemediationButton>
                                ) : null}
                                {group.category === "data" ? (
                                  <SourceRemediationButton
                                    action="refresh_specific_metadata"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    sourceIds={group.items.map((item) => item.label.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Refreshing..."
                                    title="Refresh metadata for sources in this data-failure group."
                                  >
                                    <span className="hidden sm:inline">Refresh metadata</span>
                                    <span className="sm:hidden">Refresh</span>
                                  </SourceRemediationButton>
                                ) : null}
                                {group.category === "unknown" ? (
                                  <SourceRemediationButton
                                    action="pause_and_clear_specific"
                                    nextPath={failureCenterNextHref}
                                    category={group.category}
                                    actionLabel="pause + clear unknown failures"
                                    scopeLabel="selected unknown-failure group"
                                    sourceIds={group.items.map((item) => item.label.id)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    pendingText="Pausing..."
                                    confirmMessage={`Pause ${group.items.length} unclassified source${group.items.length === 1 ? "" : "s"} and clear current flags so they stop retrying while you inspect them?`}
                                    title="Pause these sources and clear their current unknown error flags."
                                  >
                                    <span className="hidden sm:inline">Pause + clear flags</span>
                                    <span className="sm:hidden">Pause + clear</span>
                                  </SourceRemediationButton>
                                ) : null}
                              </div>
                            </div>
                            <div className="divide-y divide-[color-mix(in_oklab,var(--color-border)_65%,transparent)] rounded-md border border-[color-mix(in_oklab,var(--color-border)_60%,transparent)]">
                              {group.items.slice(0, 4).map(({ label, error }) => (
                                <div key={label.id} className="flex flex-wrap items-start justify-between gap-2 px-2 py-2">
                                  <div className="min-w-0">
                                    <Link href={`/labels/${label.id}`} className="line-clamp-1 text-xs font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
                                      {label.name}
                                    </Link>
                                    <p className="hidden text-[10px] text-[var(--color-muted)] sm:block">
                                      Last attempt {new Date(label.updatedAt).toLocaleString()} • Retries {label.retryCount}
                                    </p>
                                    <p className="line-clamp-2 text-[11px] text-[var(--color-muted)]">{error}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Link href={`/labels/${label.id}`}>
                                      <Button type="button" size="sm" variant="ghost" className="hidden h-7 w-7 p-0 sm:inline-flex" aria-label="Open source">
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </Link>
                                    <SourceRetryButton
                                      labelId={label.id}
                                      canProcess={true}
                                      compactLabel
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px]"
                                      title="Run one immediate processing step for this source"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            {group.items.length > 4 ? (
                              <p className="text-[10px] text-[var(--color-muted)]">+{group.items.length - 4} more in this group.</p>
                            ) : null}
                          </div>
                        </details>
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
                emptyState={listeningEmptyState}
                defaultHideAlreadyPlayed={false}
              />
            </CardContent>
          </Card>
      </section>
      ) : null}

      {activeTab === "library" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[linear-gradient(140deg,color-mix(in_oklab,var(--color-surface2)_88%,transparent),var(--color-surface2))] p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Library Views</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                <SegmentedControlLink
                  active={selectedLibraryView === "library"}
                  href={libraryViewHref("library")}
                  className="gap-1.5"
                  title="Saved tracks and wishlisted records"
                >
                  <Bookmark className="h-4 w-4" />
                  Library
                </SegmentedControlLink>
                <SegmentedControlLink
                  active={selectedLibraryView === "history"}
                  href={libraryViewHref("history")}
                  className="gap-1.5"
                  title="Tracks that have been played"
                >
                  <History className="h-4 w-4" />
                  History
                </SegmentedControlLink>
                <SegmentedControlLink
                  active={selectedLibraryView === "reviewed"}
                  href={libraryViewHref("reviewed")}
                  className="gap-1.5"
                  title="Tracks marked reviewed"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Reviewed
                </SegmentedControlLink>
                <SegmentedControlLink
                  active={selectedLibraryView === "needs-review"}
                  href={libraryViewHref("needs-review")}
                  className="gap-1.5"
                  title="Played tracks still waiting for review"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Needs Review
                </SegmentedControlLink>
                </div>
                <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {showLibraryItemsSection ? <Badge>Saved Tracks {totalSavedCount}</Badge> : null}
                  <Badge>Wishlisted Records {totalWishlistedRecords}</Badge>
                  {selectedLibraryView === "history" ? <Badge>History Items {historyCount}</Badge> : null}
                  {selectedLibraryView === "reviewed" ? <Badge>Reviewed Items {reviewedCount}</Badge> : null}
                  {selectedLibraryView === "needs-review" ? <Badge>Needs Review {needsReviewCount}</Badge> : null}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Actions</p>
                {showLibraryItemsSection && hasDiscogs ? (
                  <div className="mt-1.5 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <ManualWishlistSyncButton enabled={hasDiscogs} importLabel className="w-full sm:w-auto" />
                  <SyncSavedToDiscogsButton enabled={hasDiscogs} />
                  <ManualWishlistSyncButton enabled={hasDiscogs} compact className="w-full sm:w-auto" />
                  </div>
                ) : showLibraryItemsSection ? (
                  <div className="mt-1.5">
                    <DiscogsRequiredNotice context="wishlist_actions" compact />
                  </div>
                ) : null}
                {showLibraryItemsSection ? (
                  <div className="mt-1.5">
                    {hasDiscogs ? (
                      <WishlistSyncStatus initialStatus={wantsSyncStatus} compact />
                    ) : (
                      <DiscogsRequiredNotice context="wishlist_sync_status" compact />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {showLibraryItemsSection ? (
            <Card>
              <CardHeader>
                <CardTitle>Library Items</CardTitle>
                <p className="text-xs text-[var(--color-muted)]">Use filters to split saved tracks from wishlisted records.</p>
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
                  emptyState={libraryItemsEmptyState}
                  showQueueFilters={false}
                  showWishlistSourceFilter
                />

                <YoutubePlaylistExportButton
                  oauthConfigured={youtubeOAuthConfigured}
                  youtubeConnected={youtubeOAuthConnected}
                  eligibleSavedCount={playableSavedCount}
                  channelTitle={youtubeChannelTitle}
                  connectNextPath="/?tab=library&libraryView=library"
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
                          <ExternalLinkRow
                            key={`${item.type}-${item.id}-${item.url}`}
                            href={item.url}
                            title={item.title}
                            meta={
                              <>
                              {item.bandName} • {item.type}
                              </>
                            }
                          />
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
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Current Activity</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {selectedLibraryView === "reviewed"
                    ? "Tracks you marked reviewed."
                    : selectedLibraryView === "needs-review"
                      ? "Played tracks still waiting for review."
                      : "Tracks played at least once."}
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
                emptyState={reviewedEmptyState}
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
