export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { runUserJsonRoute } from "@/lib/api-user-route";
import { db } from "@/lib/db";
import { resolveSourceNextBlocker } from "@/lib/source-next-blocker";
import { selectNextSourceId } from "@/lib/source-next-processing";
import { buildSourceStatusCounts } from "@/lib/source-next-state";

export async function GET() {
  return runUserJsonRoute(
    async (userId) => {
      const activeLabels = await db.query.labels.findMany({
        where: and(eq(labels.userId, userId), eq(labels.active, true)),
        columns: { id: true, status: true, lastError: true, updatedAt: true },
        orderBy: [asc(labels.updatedAt)],
      });

      const counts = buildSourceStatusCounts(activeLabels.map((label) => label.status));
      const nextLabelId = selectNextSourceId(activeLabels);

      return {
        nextLabelId,
        nextSourceId: nextLabelId,
        counts,
        activeCount: activeLabels.length,
        blocker: resolveSourceNextBlocker({
          nextSourceId: nextLabelId,
          errorCount: counts.error,
          activeCount: activeLabels.length,
        }),
      };
    },
    { errorMessage: "Unable to load next source state." },
  );
}
