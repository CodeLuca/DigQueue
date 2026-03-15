export const dynamic = "force-dynamic";

import Image from "next/image";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/button-link";
import { ClientRouteRefreshBridge } from "@/components/client-route-refresh-bridge";
import { DiscogsLink } from "@/components/discogs-link";
import { EmptyStateNote } from "@/components/empty-state-note";
import { EntityDetailHeader } from "@/components/entity-detail-header";
import { ExternalActionLink } from "@/components/external-action-link";
import { MediaActionRow } from "@/components/media-action-row";
import { ProcessingToggle } from "@/components/processing-toggle";
import { SectionCardHeader } from "@/components/section-card-header";
import { SourceRefreshButton } from "@/components/source-refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getLabelDetail } from "@/lib/queries";
import { getSourceViewModel } from "@/lib/source-view";

export default async function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ playableOnly?: string }>;
}) {
  const { id } = await params;
  const { playableOnly } = await searchParams;
  const data = await getLabelDetail(Number(id));
  if (!data) notFound();
  const onlyPlayable = playableOnly === "1";
  const visibleReleases = onlyPlayable ? data.releases.filter((release) => release.youtubeMatched) : data.releases;

  const processedPct = data.progress.total ? Math.round((data.progress.processed / data.progress.total) * 100) : 0;
  const matchedPct = data.progress.total ? Math.round((data.progress.matched / data.progress.total) * 100) : 0;
  const notableReleases = (() => {
    try {
      return JSON.parse(data.label.notableReleasesJson) as string[];
    } catch {
      return [];
    }
  })();
  const sourceView = getSourceViewModel({
    active: Boolean(data.label.active),
    status: data.label.status,
    lastError: data.label.lastError,
    currentPage: data.label.currentPage,
    totalPages: data.label.totalPages,
  });
  const { scannedPages, totalPages: safeTotalPages } = sourceView.progressPages;

  return (
    <main className="pb-player-safe mx-auto max-w-[1400px] px-3 py-5 sm:px-4 md:px-8 md:py-6">
      <ClientRouteRefreshBridge />
      <EntityDetailHeader
        actions={
          <>
          <Badge>{data.label.active ? "active" : "inactive"}</Badge>
          <Badge>{sourceView.progressState}</Badge>
          <ProcessingToggle
            key={`${data.label.id}-${data.label.active ? "1" : "0"}-${data.label.status}`}
            labelId={data.label.id}
            initialActive={Boolean(data.label.active)}
            initialStatus={data.label.status}
          />
          </>
        }
        subtitle={`Label ID ${data.label.id}`}
        title={data.label.name}
      />

      <Card className="mb-4">
        <SectionCardHeader title="Label Overview" />
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            {data.label.imageUrl ? (
              <Image
                src={data.label.imageUrl}
                alt={`${data.label.name} label`}
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-md border border-[var(--color-border)] object-cover"
              />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)]" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="line-clamp-4 text-sm text-[var(--color-muted)]">
                {data.label.blurb || "No Discogs profile text yet. Use Refresh info to fetch this label's description."}
              </p>
              {notableReleases.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {notableReleases.slice(0, 5).map((entry) => <Badge key={`${data.label.id}-${entry}`}>{entry}</Badge>)}
                </div>
              ) : null}
            </div>
          </div>

          {sourceView.visibleError ? (
            <p className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-sm text-red-200">
              Last sync error: {sourceView.visibleError}
            </p>
          ) : null}
          <div>
            <p className="text-sm">Releases loaded: {data.progress.processed}/{data.progress.total}</p>
            <Progress value={processedPct} className="mt-1" />
          </div>
          <p className="text-xs text-[var(--color-muted)]">Pages scanned: {scannedPages}/{safeTotalPages}</p>
          <div>
            <p className="text-sm">Releases matched: {data.progress.matched}/{data.progress.total}</p>
            <Progress value={matchedPct} className="mt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DiscogsLink discogsUrl={data.label.discogsUrl} title="Open label on Discogs" variant="textButton" />
            <SourceRefreshButton labelId={data.label.id} compactLabel />
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionCardHeader
          actions={
            <form method="GET" className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <input type="checkbox" name="playableOnly" value="1" defaultChecked={onlyPlayable} />
                Playable only
              </label>
              <Button type="submit" size="sm" variant="secondary">Apply</Button>
              {onlyPlayable ? (
                <ButtonLink href={`/labels/${data.label.id}`} size="sm" variant="outline">Reset</ButtonLink>
              ) : null}
            </form>
          }
          title="Releases"
        />
        <CardContent className="space-y-2">
          {visibleReleases.map((release) => (
            <div key={release.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <MediaActionRow
                size="lg"
                artworkAlt={`${release.title} artwork`}
                artworkUrl={release.thumbUrl}
                title={<ButtonLink href={`/releases/${release.id}`} className="h-auto justify-start px-0 py-0 text-sm hover:brightness-100" variant="ghost">{release.title}</ButtonLink>}
                meta={
                  <>
                    {release.artist} • {release.catno || "No catno"} • {release.year || "n/a"}
                    {release.processingError ? <span className="block line-clamp-2 text-red-300">{release.processingError}</span> : null}
                  </>
                }
                actions={
                  <ExternalActionLink
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${release.artist} ${release.title} ${release.catno || ""}`)}`}
                    variant="compactButton"
                    title="Search this release on YouTube"
                  >
                    YouTube
                  </ExternalActionLink>
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {release.detailsFetched ? <Badge>tracks</Badge> : null}
                {release.youtubeMatched ? <Badge>youtube</Badge> : null}
                {release.wishlist ? <Badge>wishlist</Badge> : null}
                {release.matchConfidence > 0 ? <Badge>{Math.round(release.matchConfidence * 100)}% conf</Badge> : null}
              </div>
            </div>
          ))}
          {visibleReleases.length === 0 ? <EmptyStateNote title="No releases match this filter." /> : null}
        </CardContent>
      </Card>
    </main>
  );
}
