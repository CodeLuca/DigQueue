export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Bookmark,
  CheckCircle2,
  Disc3,
  ExternalLink,
  Heart,
  History,
  Inbox,
  Lightbulb,
  ListTodo,
  PlayCircle,
  RefreshCcw,
} from "lucide-react";
import {
  addLabelAction,
  clearPlayedQueueAction,
  pullDiscogsWantsAction,
  refreshLabelMetadataAction,
  refreshMissingLabelMetadataAction,
  retryErroredLabelsAction,
  retryLabelAction,
} from "@/app/actions";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { LabelDeleteButton } from "@/components/label-delete-button";
import { ListenInboxClient } from "@/components/listen-inbox-client";
import { ProcessingToggle } from "@/components/processing-toggle";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { RecentlyPlayedList } from "@/components/recently-played-list";
import { SyncSavedToDiscogsButton } from "@/components/sync-saved-to-discogs-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { getBandcampWishlistData } from "@/lib/bandcamp-wishlist";
import { toDiscogsWebUrl } from "@/lib/discogs-links";
import { syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";
import { getDashboardData, getToListenData, getWishlistData } from "@/lib/queries";
import { getVisibleLabelError } from "@/lib/utils";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ listenLabel?: string; tab?: string; labelState?: string; labelQuery?: string }>;
}) {
  const { listenLabel, tab, labelState, labelQuery } = await searchParams;
  const tabIds = ["step-1", "step-2", "wishlist", "played-reviewed", "recommendations"] as const;
  type TabId = (typeof tabIds)[number];
  const normalizedTab = tab === "step-3" ? "step-2" : tab === "played-done" ? "played-reviewed" : tab;
  const activeTab: TabId = tabIds.includes(normalizedTab as TabId) ? (normalizedTab as TabId) : "step-1";
  const selectedListenLabelId = listenLabel ? Number(listenLabel) : undefined;
  const selectedLabelState: "all" | "active" | "inactive" =
    labelState === "active" || labelState === "inactive" ? labelState : "all";
  const normalizedLabelQuery = (labelQuery || "").trim().toLowerCase();

  const keys = await getEffectiveApiKeys();
  const hasDiscogs = Boolean(keys.discogsToken);
  if (hasDiscogs) {
    try {
      await syncDiscogsWantsToLocal();
    } catch {
      // Non-blocking on page load: keep rendering even if Discogs is unavailable.
    }
  }

  const [data, listenData, wishlistData, bandcampWishlist] = await Promise.all([
    getDashboardData(),
    getToListenData(undefined, false),
    getWishlistData(undefined, false),
    getBandcampWishlistData(),
  ]);

  const hasYoutubeKey = Boolean(keys.youtubeApiKey);
  const hasYoutubeBlockedError = false;

  const canProcess = hasDiscogs;
  const activeLabels = data.labels.filter((label) => label.active);
  const queriedLabels = data.labels.filter((label) => {
    if (!normalizedLabelQuery) return true;
    const haystack = `${label.name} ${label.summaryText} ${label.discogsUrl}`.toLowerCase();
    if (haystack.includes(normalizedLabelQuery)) return true;
    try {
      const notable = JSON.parse(label.notableReleasesJson) as string[];
      return notable.some((entry) => entry.toLowerCase().includes(normalizedLabelQuery));
    } catch {
      return false;
    }
  });
  const filteredLabels = queriedLabels.filter((label) => {
    if (selectedLabelState === "active") return label.active;
    if (selectedLabelState === "inactive") return !label.active;
    return true;
  });
  const activeFilteredCount = queriedLabels.filter((label) => label.active).length;
  const inactiveFilteredCount = queriedLabels.length - activeFilteredCount;
  const filterHref = (nextState: "all" | "active" | "inactive") => {
    const params = new URLSearchParams();
    params.set("tab", "step-1");
    if (listenLabel) params.set("listenLabel", listenLabel);
    if (nextState !== "all") params.set("labelState", nextState);
    if (normalizedLabelQuery) params.set("labelQuery", labelQuery?.trim() || "");
    return `/?${params.toString()}`;
  };
  const clearSearchHref = (() => {
    const params = new URLSearchParams();
    params.set("tab", "step-1");
    if (listenLabel) params.set("listenLabel", listenLabel);
    if (selectedLabelState !== "all") params.set("labelState", selectedLabelState);
    return `/?${params.toString()}`;
  })();
  const totalSavedCount = wishlistData.rows.length;
  const totalWishlistedRecords = data.metrics.wishlistedRecords;
  const tabMeta: Record<TabId, { title: string; subtitle: string; icon: typeof Disc3 }> = {
    "step-1": {
      title: "Labels",
      subtitle: "Build your label universe, keep sources sharp, and feed the queue with intent.",
      icon: Disc3,
    },
    "step-2": {
      title: "Listening Station",
      subtitle: "Clear errors, audition candidates, and keep momentum from first play to decision.",
      icon: Inbox,
    },
    wishlist: {
      title: "Library",
      subtitle: "Track-level saves and record-level Discogs wishlist in one place.",
      icon: Bookmark,
    },
    "played-reviewed": {
      title: "Played / Reviewed",
      subtitle: "Track what you finished, what stayed in rotation, and what to leave behind.",
      icon: ListTodo,
    },
    recommendations: {
      title: "Recommendations",
      subtitle: "Signal-driven picks from your own history, not generic algorithm drift.",
      icon: Lightbulb,
    },
  };
  const activeMeta = tabMeta[activeTab];
  const ActiveTabIcon = activeMeta.icon;
  const recentlyPlayedItems = data.recentlyPlayed.map((item) => ({
    id: item.id,
    trackId: item.trackId ?? null,
    track: item.track
      ? {
          id: item.track.id,
          title: item.track.title,
          artistsText: item.track.artistsText,
          listened: item.track.listened,
          saved: item.track.saved,
        }
      : null,
    release: item.release
      ? {
          id: item.release.id,
          title: item.release.title,
          artist: item.release.artist,
          discogsUrl: item.release.discogsUrl,
          thumbUrl: item.release.thumbUrl,
          wishlist: item.release.wishlist,
        }
      : null,
    label: item.label ? { id: item.label.id, name: item.label.name } : null,
  }));
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <KeyboardShortcuts />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ActiveTabIcon className="h-6 w-6 text-[var(--color-accent)]" />
            {activeMeta.title}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">{activeMeta.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className={hasDiscogs ? "border-emerald-600/50 text-emerald-300" : "border-amber-600/50 text-amber-300"}>
              Discogs {hasDiscogs ? "Configured" : "Missing Key"}
            </Badge>
            {hasYoutubeBlockedError ? (
              <Badge className="border-red-600/50 text-red-300">YouTube Blocked</Badge>
            ) : (
              <Badge className={hasYoutubeKey ? "border-emerald-600/50 text-emerald-300" : "border-amber-600/50 text-amber-300"}>
                YouTube {hasYoutubeKey ? "Configured" : "Missing Key"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {activeTab === "step-2" ? (
      <section className="mb-5 reveal reveal-delay-1">
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Current Loaded Labels Stats</p>
          <p className="text-xs text-[var(--color-muted)]">{activeLabels.length} active loaded labels in scope</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <PlayCircle className="h-3.5 w-3.5" />
              Unplayed
            </p>
            <p className="text-xl font-semibold">{data.metrics.unplayedTracks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <History className="h-3.5 w-3.5" />
              Played
            </p>
            <p className="text-xl font-semibold">{data.metrics.playedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reviewed
            </p>
            <p className="text-xl font-semibold">{data.metrics.doneTracks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <Heart className="h-3.5 w-3.5" />
              Saved Tracks
            </p>
            <p className="text-xl font-semibold">{data.metrics.savedTracks}</p>
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
              <CardTitle>Step 1: Labels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canProcess ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="text-amber-200">
                    {hasYoutubeBlockedError
                      ? "YouTube key is blocked. Processing still works via Discogs release videos where available."
                      : "Add Discogs key to enable ingestion. YouTube key is optional fallback for releases without Discogs videos."}
                  </p>
                  <Link href="/settings" className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline">Open key setup</Link>
                </div>
              ) : null}

              <form action={addLabelAction} className="flex gap-2">
                <Input id="label-input" name="label" placeholder="Paste Discogs label URL, ID, or name" required />
                <Button type="submit">Add</Button>
              </form>

              <p className="text-xs text-[var(--color-muted)]">Toggle labels active/inactive. Active labels are included in listening and playback.</p>
              <p className="text-xs text-[var(--color-muted)]">
                Active labels: <span className="font-semibold text-[var(--color-text)]">{activeFilteredCount}</span> / {queriedLabels.length}
                {normalizedLabelQuery ? <span> (filtered from {data.labels.length} total)</span> : null}
              </p>
              <form method="GET" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="tab" value="step-1" />
                {listenLabel ? <input type="hidden" name="listenLabel" value={listenLabel} /> : null}
                {selectedLabelState !== "all" ? <input type="hidden" name="labelState" value={selectedLabelState} /> : null}
                <Input
                  name="labelQuery"
                  defaultValue={labelQuery || ""}
                  placeholder="Search labels by name, summary, release tags..."
                  className="w-full min-w-[240px] md:max-w-sm"
                />
                <Button type="submit" size="sm" variant="outline">Search</Button>
                {normalizedLabelQuery ? (
                  <Link
                    href={clearSearchHref}
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={filterHref("all")}
                  className={`rounded-md border px-2 py-1 text-xs ${selectedLabelState === "all" ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"}`}
                  title="Show all loaded labels"
                >
                  All ({queriedLabels.length})
                </Link>
                <Link
                  href={filterHref("active")}
                  className={`rounded-md border px-2 py-1 text-xs ${selectedLabelState === "active" ? "border-emerald-600/60 text-emerald-300" : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"}`}
                  title="Show only active labels used for listening"
                >
                  Active ({activeFilteredCount})
                </Link>
                <Link
                  href={filterHref("inactive")}
                  className={`rounded-md border px-2 py-1 text-xs ${selectedLabelState === "inactive" ? "border-amber-600/60 text-amber-300" : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"}`}
                  title="Show labels currently excluded from processing"
                >
                  Inactive ({inactiveFilteredCount})
                </Link>
              </div>
              <form action={refreshMissingLabelMetadataAction}>
                <Button type="submit" size="sm" variant="outline" title="Fetch profile and artwork for labels missing metadata">Refresh missing label info</Button>
              </form>

              <div className="space-y-2">
                {filteredLabels.map((label) => {
                  const visibleLastError = getVisibleLabelError(label.lastError);
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
                            alt={`${label.name} label`}
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
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{label.summaryText}</p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            Tracks loaded {label.loadedTrackCount} • Releases fetched {label.fetchedReleaseCount}/{label.loadedReleaseCount}
                          </p>
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
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {label.active ? (
                          <Badge className="border-emerald-500/70 bg-emerald-500/15 text-emerald-200">ACTIVE</Badge>
                        ) : (
                          <Badge className="border-zinc-600/40 text-zinc-400">inactive</Badge>
                        )}
                      </div>
                    </div>
                    {visibleLastError ? <p className="mt-2 line-clamp-2 text-xs text-red-300">Error: {visibleLastError}</p> : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <a
                          className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                          href={toDiscogsWebUrl(label.discogsUrl, `/label/${label.id}`)}
                          target="_blank"
                          rel="noreferrer"
                          title="Open on Discogs"
                          aria-label="Open on Discogs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <form action={refreshLabelMetadataAction}>
                          <input type="hidden" name="labelId" value={label.id} />
                          <Button type="submit" size="sm" variant="ghost" title="Refresh this label profile, image, and notable releases">
                            <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                            Refresh info
                          </Button>
                        </form>
                        {!label.tracksFullyLoaded ? (
                          <form action={retryLabelAction}>
                            <input type="hidden" name="labelId" value={label.id} />
                            <Button type="submit" size="sm" variant="outline" disabled={!canProcess} title="Retry release/track ingestion for this label">
                              Reload tracks
                            </Button>
                          </form>
                        ) : null}
                        <p className="text-xs text-[var(--color-muted)]">Retries {label.retryCount}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <LabelDeleteButton labelId={label.id} labelName={label.name} />
                        <ProcessingToggle
                          key={`${label.id}-${label.active ? "1" : "0"}-${label.status}`}
                          labelId={label.id}
                          initialActive={Boolean(label.active)}
                          initialStatus={label.status}
                          disabled={!canProcess}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
                {filteredLabels.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="text-sm text-[var(--color-muted)]">No labels match this filter.</p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <p className="text-sm font-medium">
                    {data.labels.length === 0 ? "No labels yet." : "Want more labels?"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Pull your Discogs wishlist and auto-add those labels so you have fresh records to dig through.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {hasDiscogs ? (
                      <form action={pullDiscogsWantsAction}>
                        <Button type="submit" size="sm" variant="secondary">Pull From Wishlist</Button>
                      </form>
                    ) : (
                      <Link href="/settings" className="text-xs text-[var(--color-accent)] hover:underline">Add Discogs key to enable this</Link>
                    )}
                  </div>
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
              <CardTitle>Step 2: Listening Station</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>Errors {data.metrics.labelsErrored}</Badge>
                <Badge>Low Conf {data.metrics.releasesLowConfidence}</Badge>
                <Badge>Up Next {data.queueCount}</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <form action={retryErroredLabelsAction}>
                  <Button type="submit" variant="secondary" size="sm" disabled={data.metrics.labelsErrored === 0}>Reset Errors</Button>
                </form>
              </div>

              <div className="space-y-2">
                {data.erroredLabels.slice(0, 5).map((label) => {
                  const visibleLastError = getVisibleLabelError(label.lastError);
                  return (
                    <div key={label.id} className="rounded-md border border-[var(--color-border)] p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Link href={`/labels/${label.id}`} className="line-clamp-1 text-xs font-medium hover:text-[var(--color-accent)]">{label.name}</Link>
                        <form action={retryLabelAction}>
                          <input type="hidden" name="labelId" value={label.id} />
                          <Button type="submit" size="sm" variant="ghost">Reset</Button>
                        </form>
                      </div>
                      {visibleLastError ? <p className="line-clamp-2 text-xs text-red-300">{visibleLastError}</p> : null}
                    </div>
                  );
                })}
                {data.erroredLabels.length === 0 ? <p className="text-sm text-[var(--color-muted)]">Healthy run state.</p> : null}
              </div>

              <ListenInboxClient
                initialRows={listenData.rows}
                initialSelectedLabelId={Number.isFinite(selectedListenLabelId) ? selectedListenLabelId : undefined}
                labelOptions={activeLabels.map((label) => ({
                  id: label.id,
                  name: label.name,
                  discogsUrl: label.discogsUrl,
                }))}
              />
            </CardContent>
          </Card>
      </section>
      ) : null}

      {activeTab === "wishlist" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Saved Tracks {totalSavedCount}</Badge>
                <Badge>Wishlisted Records {totalWishlistedRecords}</Badge>
              </div>
              {hasDiscogs ? (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={pullDiscogsWantsAction}>
                    <Button type="submit" size="sm" variant="outline">Pull Discogs Wants</Button>
                  </form>
                  <SyncSavedToDiscogsButton enabled={hasDiscogs} />
                </div>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">Add Discogs token in Settings to sync wants.</p>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Library Items</CardTitle>
              <p className="text-xs text-[var(--color-muted)]">Use filters to separate saved tracks and wishlisted-record items.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ListenInboxClient
                initialRows={wishlistData.rows}
                initialSelectedLabelId={Number.isFinite(selectedListenLabelId) ? selectedListenLabelId : undefined}
                labelOptions={activeLabels.map((label) => ({
                  id: label.id,
                  name: label.name,
                  discogsUrl: label.discogsUrl,
                }))}
                showQueueFilters={false}
                showWishlistSourceFilter
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
      </section>
      ) : null}

      {activeTab === "played-reviewed" ? (
      <section className="mb-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
          <Card>
            <CardHeader>
              <CardTitle>Played / Reviewed ({data.metrics.playedItems}/{data.metrics.doneTracks})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Current Loaded Labels Activity</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Playback history and reviewed progress for active loaded labels.</p>
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

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
                <p className="text-xs text-[var(--color-muted)]">Manage played history for this section.</p>
                <form action={clearPlayedQueueAction}>
                  <Button type="submit" variant="outline" size="sm" title="Remove played queue history used for this view">Clear Played History</Button>
                </form>
              </div>

              <RecentlyPlayedList items={recentlyPlayedItems} />
            </CardContent>
          </Card>
      </section>
      ) : null}

      {activeTab === "recommendations" ? (
      <section className="mt-4 grid grid-cols-1 gap-4 reveal reveal-delay-2">
        <Card>
          <CardHeader>
            <CardTitle>Recommendations ({data.recommendations.length + data.externalRecommendations.length})</CardTitle>
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
