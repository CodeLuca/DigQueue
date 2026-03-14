export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { notFoundJson, okJson } from "@/lib/api-response";
import { fetchDiscogsRelease } from "@/lib/discogs";
import { warmSourceAfterUpsert } from "@/lib/source-bootstrap";
import { buildSourceIntakeResponse } from "@/lib/source-intake-contract";
import { persistReleaseUnderSourceForUser } from "@/lib/source-release-materialization";
import { upsertSourceForUser } from "@/lib/source-upsert";

const schema = z.object({
  releaseId: z.number().int().positive(),
  entityKind: z.enum(["label", "artist"]).optional(),
});

function parseLabelIdFromResourceUrl(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\/labels?\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "labels/from-release",
    limit: 20,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const entityKind = parsed.data.entityKind ?? "label";
  const release = await fetchDiscogsRelease(parsed.data.releaseId);
  const label = (release.labels ?? []).find((item) => typeof item?.id === "number" || item?.resource_url);
  const artist = (release.artists ?? []).find((item) => typeof item?.id === "number");
  const externalLabelId =
    entityKind === "artist"
      ? (typeof artist?.id === "number" ? artist.id : null)
      : (typeof label?.id === "number" ? label.id : parseLabelIdFromResourceUrl(label?.resource_url));
  if (!externalLabelId) {
    return notFoundJson(`No ${entityKind} metadata found for release.`);
  }
  const now = new Date();
  const releaseThumbUrl = release.images?.[0]?.uri150 || release.images?.[0]?.uri || null;
  const sourceName =
    entityKind === "artist"
      ? artist?.name?.trim() || `Artist ${externalLabelId}`
      : label?.name?.trim() || `Label ${externalLabelId}`;
  const labelId = await upsertSourceForUser({
    userId,
    kind: entityKind,
    externalDiscogsId: externalLabelId,
    fallbackName: sourceName,
    active: true,
    sourceType: "workspace",
  });

  await persistReleaseUnderSourceForUser({
    userId,
    sourceId: labelId,
    externalDiscogsReleaseId: parsed.data.releaseId,
    releaseOrder: 0,
    discoveredAt: now,
    release: {
      title: release.title,
      artist: release.artists_sort || release.artists?.map((item) => item?.name).filter(Boolean).join(", ") || "Unknown Artist",
      year: release.year || null,
      catno: release.labels?.[0]?.catno || null,
      discogsUrl: `https://www.discogs.com/release/${parsed.data.releaseId}`,
      thumbUrl: releaseThumbUrl,
      detailsFetched: false,
      fetchedAt: now,
      importSource: entityKind,
    },
  });
  await warmSourceAfterUpsert({ sourceId: labelId, kind: entityKind, userId });

  return okJson(buildSourceIntakeResponse({
    sourceId: labelId,
    entityKind,
    sourceName,
  }));
}
