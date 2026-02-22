import { and, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { fetchDiscogsArtistProfile, fetchDiscogsArtistReleases, fetchDiscogsLabelProfile, fetchDiscogsLabelReleases } from "@/lib/discogs";

function normalizeReleaseTitle(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(" - ");
  if (parts.length <= 1) return trimmed;
  const artist = parts[0]?.trim();
  const title = parts.slice(1).join(" - ").trim();
  if (!artist || !title) return trimmed;
  return `${artist} - ${title}`;
}

export async function refreshSourceMetadata(sourceId: number, kind: "label" | "artist", userId?: string) {
  const [profile, releasePage] = await Promise.all(
    kind === "artist"
      ? [fetchDiscogsArtistProfile(sourceId), fetchDiscogsArtistReleases(sourceId, 1, 24)]
      : [fetchDiscogsLabelProfile(sourceId), fetchDiscogsLabelReleases(sourceId, 1, 24)],
  );

  const notable = releasePage.releases
    .map((item) => normalizeReleaseTitle(item.title))
    .filter((item): item is string => Boolean(item))
    .filter((title, index, list) => list.indexOf(title) === index)
    .slice(0, 4);

  await db
    .update(labels)
    .set({
      blurb: profile.blurb,
      imageUrl: profile.imageUrl,
      notableReleasesJson: JSON.stringify(notable),
      updatedAt: new Date(),
    })
    .where(userId ? and(eq(labels.id, sourceId), eq(labels.userId, userId)) : eq(labels.id, sourceId));
}

export async function refreshLabelMetadata(labelId: number, userId?: string) {
  return refreshSourceMetadata(labelId, "label", userId);
}
