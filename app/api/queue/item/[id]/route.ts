export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { queueItems } from "@/db/schema";
import { parsePositiveIntRouteParam } from "@/lib/api-route-params";
import { requireMutationUser } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { db } from "@/lib/db";
import { buildQueueItemRemovalResponse } from "@/lib/queue-mutation-contract";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMutationUser({
    bucket: "queue/item-delete",
    limit: 120,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const queueItemId = await parsePositiveIntRouteParam(params, "id", "Invalid queue item id.");
  if (queueItemId.response) return queueItemId.response;

  const existing = await db.query.queueItems.findFirst({
    where: and(
      eq(queueItems.id, queueItemId.value),
      eq(queueItems.status, "pending"),
      eq(queueItems.userId, userId),
    ),
    columns: { id: true },
  });

  if (existing) {
    await db
    .delete(queueItems)
    .where(
      and(
        eq(queueItems.id, queueItemId.value),
        eq(queueItems.status, "pending"),
        eq(queueItems.userId, userId),
      ),
    );
  }

  return okJson(buildQueueItemRemovalResponse({
    queueItemId: queueItemId.value,
    removed: Boolean(existing),
  }));
}
