import { and, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { upsertSourceForUser } from "@/lib/source-upsert";

const DEFAULT_LABEL_EXTERNAL_ID = 1120990;
const DEFAULT_LABEL_NAME = "Kalahari Oyster Cult";

export async function ensureDefaultSourcesForUser(userId: string) {
  const existing = await db.query.labels.findFirst({
    where: and(eq(labels.userId, userId), eq(labels.sourceType, "workspace")),
    columns: { id: true },
  });
  if (existing) return;

  await upsertSourceForUser({
    userId,
    kind: "label",
    externalDiscogsId: DEFAULT_LABEL_EXTERNAL_ID,
    fallbackName: DEFAULT_LABEL_NAME,
    active: true,
    sourceType: "workspace",
  });
}
