import { and, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { toStoredDiscogsId } from "@/lib/discogs-id";

const DEFAULT_LABEL_EXTERNAL_ID = 1120990;
const DEFAULT_LABEL_NAME = "Kalahari Oyster Cult";
const DEFAULT_LABEL_URL = "https://www.discogs.com/label/1120990-Kalahari-Oyster-Cult";

export async function ensureDefaultSourcesForUser(userId: string) {
  const existing = await db.query.labels.findFirst({
    where: and(eq(labels.userId, userId), eq(labels.sourceType, "workspace")),
    columns: { id: true },
  });
  if (existing) return;

  const now = new Date();
  await db
    .insert(labels)
    .values({
      id: toStoredDiscogsId(userId, DEFAULT_LABEL_EXTERNAL_ID, "label"),
      userId,
      entityKind: "label",
      externalDiscogsId: DEFAULT_LABEL_EXTERNAL_ID,
      name: DEFAULT_LABEL_NAME,
      discogsUrl: DEFAULT_LABEL_URL,
      sourceType: "workspace",
      active: true,
      status: "queued",
      currentPage: 1,
      totalPages: 1,
      retryCount: 0,
      lastError: null,
      addedAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}
