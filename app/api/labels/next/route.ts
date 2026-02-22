export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { labels } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";

export async function GET() {
  const userId = await requireCurrentAppUserId();
  const activeLabels = await db.query.labels.findMany({
    where: and(eq(labels.userId, userId), eq(labels.active, true)),
    columns: { id: true, status: true, lastError: true, updatedAt: true },
    orderBy: [asc(labels.updatedAt)],
  });

  const counts = {
    queued: 0,
    processing: 0,
    error: 0,
    paused: 0,
    complete: 0,
    other: 0,
  };

  for (const label of activeLabels) {
    if (label.status === "queued") counts.queued += 1;
    else if (label.status === "processing") counts.processing += 1;
    else if (label.status === "error") counts.error += 1;
    else if (label.status === "paused") counts.paused += 1;
    else if (label.status === "complete") counts.complete += 1;
    else counts.other += 1;
  }

  const nextProcessing = activeLabels.find((label) => label.status === "processing");
  const nextQueued = activeLabels.find((label) => label.status === "queued");
  const nextLabelId = nextProcessing?.id ?? nextQueued?.id ?? null;

  return NextResponse.json({
    nextLabelId,
    counts,
    activeCount: activeLabels.length,
    blocker:
      nextLabelId !== null
        ? null
        : counts.error > 0
          ? "Only errored labels remain. Retry or clear errors to continue."
          : activeLabels.length === 0
            ? "No active labels."
            : "No queued/processing labels.",
  });
}
