import { and, desc, eq, sql } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { toStoredSourceId } from "@/lib/discogs-id";
import { getFallbackSourceName } from "@/lib/source-display";
import { mergeSourceType, shouldActivateSource, shouldQueueSourceAfterUpsert } from "@/lib/source-upsert-policy";

type SourceKind = "label" | "artist";

export async function upsertSourceForUser(input: {
  userId: string;
  kind: SourceKind;
  externalDiscogsId: number;
  fallbackName?: string;
  active?: boolean;
  sourceType?: string;
}) {
  const now = new Date();
  const storedLabelId = toStoredSourceId(input.userId, input.externalDiscogsId, input.kind);
  const name = input.fallbackName || getFallbackSourceName(input.kind, input.externalDiscogsId);
  const sourceType = mergeSourceType(null, input.sourceType || "workspace");
  const active = shouldActivateSource(false, input.active ?? true);
  const shouldQueue = shouldQueueSourceAfterUpsert({ sourceType: input.sourceType || "workspace", active: input.active ?? true });

  await db
    .insert(labels)
    .values({
      id: storedLabelId,
      userId: input.userId,
      entityKind: input.kind,
      externalDiscogsId: input.externalDiscogsId,
      name,
      discogsUrl: `https://www.discogs.com/${input.kind}/${input.externalDiscogsId}`,
      sourceType,
      active,
      status: shouldQueue ? "queued" : "paused",
      currentPage: 1,
      totalPages: 1,
      retryCount: 0,
      lastError: shouldQueue ? null : null,
      addedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [labels.userId, labels.entityKind, labels.externalDiscogsId],
      set: {
        name,
        discogsUrl: `https://www.discogs.com/${input.kind}/${input.externalDiscogsId}`,
        sourceType: sql`case
          when ${labels.sourceType} = 'workspace' or excluded.source_type = 'workspace' then 'workspace'
          else coalesce(${labels.sourceType}, excluded.source_type)
        end`,
        active: sql`(${labels.active} or excluded.active)`,
        status: shouldQueue
          ? sql`'queued'`
          : sql`coalesce(${labels.status}, 'paused')`,
        lastError: shouldQueue
          ? sql`null`
          : labels.lastError,
        updatedAt: now,
      },
    });

  const stored = await db.query.labels.findFirst({
    where: and(
      eq(labels.userId, input.userId),
      eq(labels.entityKind, input.kind),
      eq(labels.externalDiscogsId, input.externalDiscogsId),
    ),
    columns: { id: true },
    orderBy: [desc(labels.updatedAt), desc(labels.id)],
  });

  if (!stored) {
    throw new Error("Unable to persist source.");
  }

  return stored.id;
}
