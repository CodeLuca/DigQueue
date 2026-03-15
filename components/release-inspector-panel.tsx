"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { ActionRow } from "@/components/action-row";
import { EmptyStateNote } from "@/components/empty-state-note";
import { ExternalActionLink } from "@/components/external-action-link";
import { ExternalLinkRow } from "@/components/external-link-row";
import { SupportText } from "@/components/support-text";
import {
  getReleaseInspectorPanelClassName,
  ReleaseInspectorMetricCell,
  ReleaseInspectorPanelSection,
} from "@/components/release-inspector-panels";
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
      {releaseDetailsLoading ? <SupportText>Loading Discogs details…</SupportText> : null}
      {releaseDetailsError ? <p className="text-xs text-rose-300">{releaseDetailsError}</p> : null}
      {!releaseDetailsLoading && !releaseDetailsError && releaseDetails ? (
        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <div className={getReleaseInspectorPanelClassName("p-2.5")}>
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
              <SupportText className="line-clamp-1">{releaseInspector.currentArtist || "Unknown artist"}</SupportText>
              <SupportText className="line-clamp-2">{current?.release?.title || releaseDetails.title || "Unknown release"}</SupportText>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <ReleaseInspectorPanelSection title="Release Snapshot">
              <p className="mt-1 text-sm font-medium">{releaseDetails.title}</p>
              <SupportText className="mt-1">{releaseDetails.year || "n/a"} • {releaseDetails.country || "n/a"}</SupportText>
              <SupportText className="mt-1 line-clamp-2">{releaseInspector.currentLabel || "Label unknown"}</SupportText>
              <SupportText className="mt-1 line-clamp-2">{releaseInspector.currentFormats || "Format unknown"}</SupportText>
              <SupportText className="mt-1 line-clamp-2">{releaseInspector.currentGenreStyles || "No genre/style tags"}</SupportText>
            </ReleaseInspectorPanelSection>
            <ReleaseInspectorPanelSection title="Market Snapshot">
              <div className="mt-1 grid grid-cols-2 gap-2">
                <ReleaseInspectorMetricCell
                  label="Median"
                  value={formatReleasePrice(releaseDetails.marketStats?.median_price, releaseInspector.marketCurrency)}
                />
                <ReleaseInspectorMetricCell
                  label="Lowest"
                  value={formatReleasePrice(releaseDetails.marketStats?.lowest_price, releaseInspector.marketCurrency)}
                />
              </div>
              <SupportText className="mt-2">
                {releaseDetails.marketStats?.num_for_sale ?? "n/a"} listed
                {releaseInspector.marketSpreadPercent !== null ? ` • median is ${releaseInspector.marketSpreadPercent}% above lowest` : ""}
              </SupportText>
              <SupportText className="mt-1">
                Rating: {typeof releaseDetails.community?.rating?.average === "number"
                  ? `${releaseDetails.community.rating.average.toFixed(2)} (${releaseDetails.community.rating.count ?? 0})`
                  : "n/a"}
              </SupportText>
              <SupportText className="mt-1">
                Have {releaseDetails.community?.have ?? "n/a"} • Want {releaseDetails.community?.want ?? "n/a"}
              </SupportText>
              {releaseDetails.marketStats?.blocked_from_sale ? (
                <span className="mt-2 inline-flex rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300">Sale blocked</span>
              ) : null}
            </ReleaseInspectorPanelSection>
            <ReleaseInspectorPanelSection title="Price Guide (By Condition)">
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
                <EmptyStateNote title="No condition pricing available from Discogs for this release." className="mt-1 text-xs" />
              )}
            </ReleaseInspectorPanelSection>
            <ReleaseInspectorPanelSection title="Open Links" className="lg:col-span-2 2xl:col-span-3">
              <ActionRow>
                {releaseLinksLoading ? <SupportText as="span" size="10">finding stores…</SupportText> : null}
                {releaseLinksError ? <span className="text-[10px] text-rose-300">{releaseLinksError}</span> : null}
              </ActionRow>
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
            </ReleaseInspectorPanelSection>
            {showFinderCandidates && releaseLinks?.bestBandcamp ? (
              <ReleaseInspectorPanelSection title="Best Bandcamp Match" className="lg:col-span-2 2xl:col-span-3">
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
              </ReleaseInspectorPanelSection>
            ) : null}
            {showFinderCandidates && releaseLinks?.bandcamp?.length ? (
              <ReleaseInspectorPanelSection title="Bandcamp Candidates" className="lg:col-span-2 2xl:col-span-3">
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
              </ReleaseInspectorPanelSection>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
