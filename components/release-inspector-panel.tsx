"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { ExternalActionLink } from "@/components/external-action-link";
import { ExternalLinkRow } from "@/components/external-link-row";
import type { FinderCandidate } from "@/lib/client-release-data";
import { releaseDiscogsLinkTitle } from "@/lib/library-action-labels";
import { useReleaseInspectorData } from "@/lib/use-release-inspector-data";
import {
  buildReleaseInspectorView,
  formatReleasePrice,
  type CurrentReleaseContext,
} from "@/lib/release-inspector-view";

type ReleaseInspectorPanelProps = {
  current: CurrentReleaseContext | null;
  currentTrackTitle?: string | null;
  enabled?: boolean;
  className?: string;
  showFinderCandidates?: boolean;
};

function confidenceClass(confidence: FinderCandidate["confidence"]) {
  if (confidence === "high") return "text-emerald-300";
  if (confidence === "medium") return "text-amber-300";
  return "text-[var(--color-muted)]";
}

export function ReleaseInspectorPanel({
  current,
  currentTrackTitle,
  enabled = true,
  className = "",
  showFinderCandidates = false,
}: ReleaseInspectorPanelProps) {
  const releaseId = current?.release?.id ?? null;
  const {
    releaseDetails,
    releaseDetailsLoading,
    releaseDetailsError,
    releaseLinks,
    releaseLinksLoading,
    releaseLinksError,
  } = useReleaseInspectorData(releaseId, enabled);

  const releaseInspector = buildReleaseInspectorView({ current, releaseDetails, releaseLinks });
  const contextLabel = currentTrackTitle ? "Now Playing" : "Release";
  const contextTitle = currentTrackTitle || current?.release?.title || releaseDetails?.title || "Unknown release";

  if (!enabled) return null;

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[linear-gradient(130deg,color-mix(in_oklab,var(--color-surface2)_86%,black_14%),color-mix(in_oklab,var(--color-surface)_78%,black_22%))] p-3 ${className}`.trim()}>
      {releaseDetailsLoading ? <p className="text-xs text-[var(--color-muted)]">Loading Discogs details…</p> : null}
      {releaseDetailsError ? <p className="text-xs text-rose-300">{releaseDetailsError}</p> : null}
      {!releaseDetailsLoading && !releaseDetailsError && releaseDetails ? (
        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-2.5">
            {releaseInspector.expandedArtworkUrl ? (
              <Image
                src={releaseInspector.expandedArtworkUrl}
                alt={`${current?.release?.title || releaseDetails.title || "Release"} artwork`}
                width={900}
                height={900}
                className="aspect-square w-full rounded-md border border-[var(--color-border)] object-cover"
              />
            ) : (
              <div className="aspect-square w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]" />
            )}
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{contextLabel}</p>
              <p className="line-clamp-2 text-sm font-semibold">{contextTitle}</p>
              <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{releaseInspector.currentArtist || "Unknown artist"}</p>
              <p className="line-clamp-2 text-xs text-[var(--color-muted)]">{current?.release?.title || releaseDetails.title || "Unknown release"}</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Release Snapshot</p>
              <p className="mt-1 text-sm font-medium">{releaseDetails.title}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{releaseDetails.year || "n/a"} • {releaseDetails.country || "n/a"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{releaseInspector.currentLabel || "Label unknown"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{releaseInspector.currentFormats || "Format unknown"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{releaseInspector.currentGenreStyles || "No genre/style tags"}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Market Snapshot</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Median</p>
                  <p className="text-xs font-medium">{formatReleasePrice(releaseDetails.marketStats?.median_price, releaseInspector.marketCurrency)}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Lowest</p>
                  <p className="text-xs font-medium">{formatReleasePrice(releaseDetails.marketStats?.lowest_price, releaseInspector.marketCurrency)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {releaseDetails.marketStats?.num_for_sale ?? "n/a"} listed
                {releaseInspector.marketSpreadPercent !== null ? ` • median is ${releaseInspector.marketSpreadPercent}% above lowest` : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Rating: {typeof releaseDetails.community?.rating?.average === "number"
                  ? `${releaseDetails.community.rating.average.toFixed(2)} (${releaseDetails.community.rating.count ?? 0})`
                  : "n/a"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Have {releaseDetails.community?.have ?? "n/a"} • Want {releaseDetails.community?.want ?? "n/a"}
              </p>
              {releaseDetails.marketStats?.blocked_from_sale ? (
                <span className="mt-2 inline-flex rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300">Sale blocked</span>
              ) : null}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Price Guide (By Condition)</p>
              {releaseInspector.priceSuggestionRows.length ? (
                <div className="mt-1 space-y-1.5">
                  {releaseInspector.priceSuggestionRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-muted)]">{row.label}</span>
                      <span className="font-medium">{formatReleasePrice(row.value, releaseInspector.marketCurrency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-[var(--color-muted)]">No condition pricing available from Discogs for this release.</p>
              )}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3 lg:col-span-2 2xl:col-span-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Open Links</p>
                {releaseLinksLoading ? <span className="text-[10px] text-[var(--color-muted)]">finding stores…</span> : null}
                {releaseLinksError ? <span className="text-[10px] text-rose-300">{releaseLinksError}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {releaseInspector.discogsReleaseUrl ? (
                  <ExternalActionLink
                    href={releaseInspector.discogsReleaseUrl}
                    variant="pill"
                    title={releaseDiscogsLinkTitle()}
                  >
                    Discogs
                    <ExternalLink className="h-3 w-3" />
                  </ExternalActionLink>
                ) : null}
                {releaseInspector.primaryBandcampLink ? (
                  <ExternalActionLink
                    href={releaseInspector.primaryBandcampLink}
                    variant="pill"
                    className="border-emerald-500/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                    title="Open best Bandcamp match"
                  >
                    Best Bandcamp match
                    <ExternalLink className="h-3 w-3" />
                  </ExternalActionLink>
                ) : null}
                {releaseInspector.releaseVideoUrl ? (
                  <ExternalActionLink
                    href={releaseInspector.releaseVideoUrl}
                    variant="pill"
                    title="Open release video"
                  >
                    Release video
                    <ExternalLink className="h-3 w-3" />
                  </ExternalActionLink>
                ) : null}
                {releaseInspector.fallbackShopLinks.map((link) => (
                  <ExternalActionLink
                    key={`${link.provider}-${link.url}`}
                    href={link.url}
                    variant="pill"
                    title={`Open on ${link.provider}`}
                  >
                    {link.provider[0].toUpperCase() + link.provider.slice(1)}
                    <ExternalLink className="h-3 w-3" />
                  </ExternalActionLink>
                ))}
              </div>
            </div>
            {showFinderCandidates && releaseLinks?.bestBandcamp ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3 lg:col-span-2 2xl:col-span-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Best Bandcamp Match</p>
                <a
                  className="mt-1 block text-sm font-medium text-[var(--color-accent)] hover:underline"
                  href={releaseLinks.bestBandcamp.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {releaseLinks.bestBandcamp.title}
                </a>
                <p className={`mt-1 text-xs ${confidenceClass(releaseLinks.bestBandcamp.confidence)}`}>
                  Confidence: {releaseLinks.bestBandcamp.confidence} • {releaseLinks.bestBandcamp.reason}
                </p>
              </div>
            ) : null}
            {showFinderCandidates && releaseLinks?.bandcamp?.length ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-3 lg:col-span-2 2xl:col-span-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">Bandcamp Candidates</p>
                <div className="mt-2 space-y-1.5">
                  {releaseLinks.bandcamp.map((item) => (
                    <ExternalLinkRow
                      key={item.url}
                      href={item.url}
                      title={item.title}
                      titleAccent
                      meta={`${item.confidence} • score ${item.score}`}
                      metaClassName={`text-xs ${confidenceClass(item.confidence)}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
