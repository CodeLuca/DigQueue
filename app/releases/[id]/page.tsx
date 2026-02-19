export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Bookmark, Check, Heart } from "lucide-react";
import { chooseMatchAction, toggleReleaseWishlistAction, toggleTrackAction } from "@/app/actions";
import { PlayMatchButton } from "@/components/play-match-button";
import { ReleaseLinkFinder } from "@/components/release-link-finder";
import { TrackQueueButtons } from "@/components/track-queue-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toDiscogsWebUrl } from "@/lib/discogs-links";
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
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{release.title}</h1>
          <p className="text-sm text-[var(--color-muted)]">{release.artist} • {release.label?.name} • {release.catno || "No catno"}</p>
        </div>
        <Badge className={release.wishlist ? "border-amber-600/50 text-amber-300" : ""}>
          {release.wishlist ? "Record Wishlisted" : "Record Not Wishlisted"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracks + YouTube Matches</CardTitle>
          <p className="text-xs text-[var(--color-muted)]">
            Record wishlist and track saves are separate: record wishlist syncs to Discogs, track save stays local.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleTracks.map((track) => (
            <div key={track.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
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
                  <form action={toggleTrackAction}>
                    <input type="hidden" name="trackId" value={track.id} />
                    <input type="hidden" name="field" value="listened" />
                    <input type="hidden" name="releaseId" value={release.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={track.listened ? "secondary" : "outline"}
                      title={track.listened ? "Listened" : "Mark listened"}
                      aria-label={track.listened ? "Listened" : "Mark listened"}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                  <form action={toggleTrackAction}>
                    <input type="hidden" name="trackId" value={track.id} />
                    <input type="hidden" name="field" value="saved" />
                    <input type="hidden" name="releaseId" value={release.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={track.saved ? "secondary" : "ghost"}
                      title={track.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                      aria-label={track.saved ? "Track saved. Does not add to your Discogs wantlist." : "Save track. Does not add to your Discogs wantlist."}
                    >
                      <Heart className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                  <form action={toggleReleaseWishlistAction}>
                    <input type="hidden" name="releaseId" value={release.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={release.wishlist ? "secondary" : "ghost"}
                      title={release.wishlist ? "Remove record from Discogs Wishlist" : "Add record to Discogs Wishlist"}
                      aria-label={release.wishlist ? "Remove record from Discogs Wishlist" : "Add record to Discogs Wishlist"}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </Button>
                  </form>
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
                      <a className="text-[var(--color-accent)] hover:underline" href={`https://www.youtube.com/watch?v=${match.videoId}`} target="_blank" rel="noreferrer">Open</a>
                      <form action={chooseMatchAction}>
                        <input type="hidden" name="trackId" value={track.id} />
                        <input type="hidden" name="matchId" value={match.id} />
                        <input type="hidden" name="releaseId" value={release.id} />
                        <Button size="sm" type="submit" variant="ghost">Choose</Button>
                      </form>
                    </div>
                  </div>
                ))}
                {track.matches.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">
                    No matches yet. Use Queue/Play now to auto-find a playable YouTube result.
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {visibleTracks.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No tracks found for this release.</p> : null}
        </CardContent>
      </Card>

      <section className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <a href={toDiscogsWebUrl(release.discogsUrl, `/release/${release.id}`)} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface2)]">Open on Discogs</a>
        <a href={`https://bandcamp.com/search?q=${encodeURIComponent(`${release.artist} ${release.title}`)}`} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface2)]">Quick Bandcamp Search</a>
        <a href={`https://www.juno.co.uk/search/?q[all][]=${encodeURIComponent(`${release.artist} ${release.title}`)}`} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface2)]">Search on Juno</a>
        <a href={`https://www.hardwax.com/?search=${encodeURIComponent(`${release.artist} ${release.title}`)}`} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface2)]">Search on Hardwax</a>
        <a href={`https://www.phonicarecords.com/search?search=${encodeURIComponent(`${release.artist} ${release.title}`)}`} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface2)]">Search on Phonica</a>
      </section>

      <ReleaseLinkFinder releaseId={release.id} />
    </main>
  );
}
