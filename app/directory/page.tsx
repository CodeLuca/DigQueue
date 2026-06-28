import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Bookmark, Disc3, ExternalLink, Headphones, Library, Music2, Radio, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicDirectoryData } from "@/lib/public-directory";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function imageSlot(url: string | null | undefined, alt: string) {
  if (!url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-muted)]">
        <Music2 className="h-5 w-5" />
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      width={64}
      height={64}
      className="h-16 w-16 shrink-0 rounded-md border border-[var(--color-border)] object-cover"
    />
  );
}

function DirectoryItem({
  artworkUrl,
  title,
  meta,
  href,
  badge,
}: {
  artworkUrl?: string | null;
  title: string;
  meta: string;
  href?: string | null;
  badge?: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-2">
      {imageSlot(artworkUrl, `${title} artwork`)}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{title}</p>
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{meta}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EmptyDirectorySection({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface2)] p-3 text-sm text-[var(--color-muted)]">
      {title}
    </div>
  );
}

export default async function DirectoryPage() {
  const data = await getPublicDirectoryData();

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 pb-12 sm:px-4 md:px-8 md:py-6">
      <header className="mb-5 rounded-xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(34,211,238,0.12),transparent_44%),var(--color-surface2)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Radio className="h-6 w-6 text-[var(--color-accent)]" />
              Public Directory
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
              A read-only view of what the DigQueue community is adding, queuing, saving, and wanting. User identities stay private.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/login" size="sm">Login</ButtonLink>
            <ButtonLink href="/register" size="sm" variant="outline">Register</ButtonLink>
          </div>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="People digging" value={data.stats.activeUsers} icon={<Headphones className="h-3.5 w-3.5" />} />
        <Stat label="Sources added" value={data.stats.sources} icon={<Disc3 className="h-3.5 w-3.5" />} />
        <Stat label="Releases found" value={data.stats.releases} icon={<Library className="h-3.5 w-3.5" />} />
        <Stat label="Queue items" value={data.stats.queuedItems} icon={<Radio className="h-3.5 w-3.5" />} />
        <Stat label="Saved tracks" value={data.stats.savedTracks} icon={<Bookmark className="h-3.5 w-3.5" />} />
        <Stat label="Want records" value={data.stats.wantedRecords} icon={<Sparkles className="h-3.5 w-3.5" />} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently Added Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.latestSources.length === 0 ? <EmptyDirectorySection title="No public source activity yet." /> : null}
            {data.latestSources.map((source) => (
              <DirectoryItem
                key={`source-${source.id}`}
                artworkUrl={source.imageUrl}
                title={source.name}
                meta={`${source.entityKind} • ${source.active ? "active" : source.status} • added ${formatDate(source.addedAt)}`}
                href={source.discogsUrl}
                badge={source.entityKind}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Queued / Played</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentQueue.length === 0 ? <EmptyDirectorySection title="No queue activity yet." /> : null}
            {data.recentQueue.map((item) => (
              <DirectoryItem
                key={`queue-${item.id}`}
                artworkUrl={item.releaseThumbUrl}
                title={item.trackTitle}
                meta={`${item.trackArtists || item.releaseArtist} • ${item.releaseTitle} • ${item.labelName} • ${formatDate(item.addedAt)}`}
                href={item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : item.releaseDiscogsUrl}
                badge={item.status}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Newly Found Releases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentReleases.length === 0 ? <EmptyDirectorySection title="No releases have been scanned yet." /> : null}
            {data.recentReleases.map((release) => (
              <DirectoryItem
                key={`release-${release.id}`}
                artworkUrl={release.thumbUrl}
                title={release.title}
                meta={`${release.artist} • ${release.labelName}${release.year ? ` • ${release.year}` : ""}${release.catno ? ` • ${release.catno}` : ""}`}
                href={release.discogsUrl}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Tracks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.savedTracks.length === 0 ? <EmptyDirectorySection title="No saved tracks yet." /> : null}
            {data.savedTracks.map((track) => (
              <DirectoryItem
                key={`saved-${track.id}`}
                artworkUrl={track.releaseThumbUrl}
                title={track.title}
                meta={`${track.artistsText || track.releaseArtist} • ${track.releaseTitle} • ${track.labelName}`}
                href={track.releaseDiscogsUrl}
                badge="saved"
              />
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Want Records</CardTitle>
          </CardHeader>
          <CardContent>
            {data.wantedReleases.length === 0 ? <EmptyDirectorySection title="No wanted records yet." /> : null}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {data.wantedReleases.map((release) => (
                <DirectoryItem
                  key={`want-${release.id}`}
                  artworkUrl={release.thumbUrl}
                  title={release.title}
                  meta={`${release.artist} • ${release.labelName}${release.year ? ` • ${release.year}` : ""}${release.catno ? ` • ${release.catno}` : ""}`}
                  href={release.discogsUrl}
                  badge="want"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="mt-6 text-xs text-[var(--color-muted)]">
        <Link href="/how-to-use" className="text-[var(--color-accent)] hover:underline">How DigQueue works</Link>
      </footer>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{value.toLocaleString()}</p>
    </div>
  );
}
