export const dynamic = "force-dynamic";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { notFound } from "next/navigation";
import { refreshLabelMetadataAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ProcessingToggle } from "@/components/processing-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getLabelDetail } from "@/lib/queries";
import { getVisibleLabelError } from "@/lib/utils";

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
  const visibleLastError = getVisibleLabelError(data.label.lastError);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{data.label.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">Label ID {data.label.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{data.label.active ? "active" : "inactive"}</Badge>
          <ProcessingToggle
            key={`${data.label.id}-${data.label.active ? "1" : "0"}-${data.label.status}`}
            labelId={data.label.id}
            initialActive={Boolean(data.label.active)}
            initialStatus={data.label.status}
          />
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Label Overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            {data.label.imageUrl ? (
              <img
                src={data.label.imageUrl}
                alt={`${data.label.name} label`}
                className="h-20 w-20 shrink-0 rounded-md border border-[var(--color-border)] object-cover"
                loading="lazy"
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

          {visibleLastError ? (
            <p className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-sm text-red-200">
              Last sync error: {visibleLastError}
            </p>
          ) : null}
          <div>
            <p className="text-sm">Releases loaded: {data.progress.processed}/{data.progress.total}</p>
            <Progress value={processedPct} className="mt-1" />
          </div>
          <div>
            <p className="text-sm">Releases matched: {data.progress.matched}/{data.progress.total}</p>
            <Progress value={matchedPct} className="mt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={data.label.discogsUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-accent)] hover:underline">Open on Discogs</a>
            <form action={refreshLabelMetadataAction}>
              <input type="hidden" name="labelId" value={data.label.id} />
              <Button type="submit" size="sm" variant="ghost">
                <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                Refresh info
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Releases</CardTitle>
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <input type="checkbox" name="playableOnly" value="1" defaultChecked={onlyPlayable} />
              Playable only
            </label>
            <Button type="submit" size="sm" variant="secondary">Apply</Button>
            {onlyPlayable ? (
              <Link href={`/labels/${data.label.id}`} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-surface2)]">
                Reset
              </Link>
            ) : null}
          </form>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleReleases.map((release) => (
            <div key={release.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {release.thumbUrl ? (
                    <img
                      src={release.thumbUrl}
                      alt={`${release.title} artwork`}
                      className="h-14 w-14 shrink-0 rounded-md border border-[var(--color-border)] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <Link href={`/releases/${release.id}`} className="line-clamp-1 text-sm font-medium hover:text-[var(--color-accent)]">{release.title}</Link>
                    <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{release.artist} • {release.catno || "No catno"} • {release.year || "n/a"}</p>
                    {release.processingError ? <p className="line-clamp-2 text-xs text-red-300">{release.processingError}</p> : null}
                  </div>
                </div>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${release.artist} ${release.title} ${release.catno || ""}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-surface2)]"
                >
                  YouTube
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {release.detailsFetched ? <Badge>tracks</Badge> : null}
                {release.youtubeMatched ? <Badge>youtube</Badge> : null}
                {release.wishlist ? <Badge>wishlist</Badge> : null}
                {release.matchConfidence > 0 ? <Badge>{Math.round(release.matchConfidence * 100)}% conf</Badge> : null}
              </div>
            </div>
          ))}
          {visibleReleases.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No releases match this filter.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
