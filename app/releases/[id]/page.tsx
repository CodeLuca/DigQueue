export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ClientRouteRefreshBridge } from "@/components/client-route-refresh-bridge";
import { ChooseMatchButton } from "@/components/choose-match-button";
import { EmptyStateNote } from "@/components/empty-state-note";
import { EntityDetailHeader } from "@/components/entity-detail-header";
import { ExternalActionLink } from "@/components/external-action-link";
import { InsetPanel } from "@/components/inset-panel";
import { PlayMatchButton } from "@/components/play-match-button";
import { ReleaseInspectorPanel } from "@/components/release-inspector-panel";
import { SectionCardHeader } from "@/components/section-card-header";
import { ReleaseTrackTodoButton } from "@/components/release-track-todo-button";
import { ReleaseWishlistButton } from "@/components/release-wishlist-button";
import { TrackQueueButtons } from "@/components/track-queue-buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReleaseDetail } from "@/lib/queries";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const release = await getReleaseDetail(Number(id));
  if (!release) notFound();
  const visibleTracks = release.tracks;

  return (
    <main className="pb-player-safe mx-auto max-w-[1400px] px-3 py-5 sm:px-4 md:px-8 md:py-6">
      <ClientRouteRefreshBridge />
      <EntityDetailHeader
        actions={
          <>
          <Badge className={release.wishlist ? "border-amber-600/50 text-amber-300" : ""}>
            {release.wishlist ? "Record Wishlisted" : "Record Not Wishlisted"}
          </Badge>
          <ReleaseWishlistButton releaseId={release.id} wishlisted={release.wishlist} />
          </>
        }
        meta={`${visibleTracks.length} track${visibleTracks.length === 1 ? "" : "s"} on this release`}
        subtitle={`${release.artist} • ${release.label?.name} • ${release.catno || "No catno"}`}
        title={release.title}
      />

      <Card>
        <SectionCardHeader
          description="Record wishlist and track saves are separate: record wishlist syncs to Discogs, track save stays local."
          title="Tracks + YouTube Matches"
        />
        <CardContent className="space-y-3">
          {visibleTracks.map((track) => (
            <InsetPanel key={track.id}>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{track.position} {track.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{track.artistsText || "Unknown artist"} {track.duration ? `• ${track.duration}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <TrackQueueButtons
                    trackId={track.id}
                    youtubeSearchUrl={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${track.artistsText || release.artist} ${track.title} ${release.label?.name || ""} ${release.catno || ""}`,
                    )}`}
                  />
                  <ReleaseTrackTodoButton trackId={track.id} field="listened" active={track.listened} />
                  <ReleaseTrackTodoButton trackId={track.id} field="saved" active={track.saved} />
                </div>
              </div>

              <div className="space-y-1">
                {track.matches.slice(0, 5).map((match) => (
                  <div key={match.id} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-1">{match.title}</p>
                      <p className="line-clamp-1 text-[var(--color-muted)]">{match.channelTitle} • score {match.score.toFixed(1)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {match.chosen ? <Badge>chosen</Badge> : null}
                      <PlayMatchButton trackId={track.id} matchId={match.id} />
                      <ExternalActionLink href={`https://www.youtube.com/watch?v=${match.videoId}`} title="Open match on YouTube" variant="textLink">
                        Open
                      </ExternalActionLink>
                      <ChooseMatchButton trackId={track.id} matchId={match.id} />
                    </div>
                  </div>
                ))}
                {track.matches.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">
                    No matches yet. Use Queue/Play now to auto-find a playable YouTube result.
                  </p>
                ) : null}
              </div>
            </InsetPanel>
          ))}
          {visibleTracks.length === 0 ? <EmptyStateNote title="No tracks found for this release." /> : null}
        </CardContent>
      </Card>

      <div className="mt-4">
        <ReleaseInspectorPanel
          current={{
            release: {
              id: release.id,
              title: release.title,
              artist: release.artist,
              catno: release.catno,
              discogsUrl: release.discogsUrl,
              thumbUrl: release.thumbUrl,
            },
          }}
          showFinderCandidates
        />
      </div>
    </main>
  );
}
