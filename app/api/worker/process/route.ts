export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { processSingleReleaseForSource } from "@/lib/processing";
import { acquireSourceWorkerLock, releaseSourceWorkerLock } from "@/lib/worker-locks";

const schema = z.object({
  sourceId: z.number().int().positive().optional(),
  labelId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const rateLimited = await guardMutationRateLimit(userId, {
    bucket: "worker/process",
    limit: 45,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sourceId = parsed.data.sourceId ?? parsed.data.labelId;
  if (!sourceId) {
    return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });
  }

  const source = await db.query.labels.findFirst({ where: and(eq(labels.id, sourceId), eq(labels.userId, userId)) });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (!source.active) {
    return NextResponse.json({ done: false, message: "Inactive" });
  }

  if (source.status === "paused") {
    return NextResponse.json({ message: "Paused" });
  }

  const lock = await acquireSourceWorkerLock(userId, sourceId, 120_000);
  if (!lock) {
    return NextResponse.json({ done: false, message: "Worker busy" });
  }

  try {
    const result = await processSingleReleaseForSource(sourceId, userId);
    return NextResponse.json(result);
  } finally {
    await releaseSourceWorkerLock(lock);
  }
}
