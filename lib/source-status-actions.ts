import { and, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import type { SourceStatusValue } from "@/lib/source-state-contract";

async function findSourceForUser(userId: string, sourceId: number) {
  return db.query.labels.findFirst({
    where: and(eq(labels.id, sourceId), eq(labels.userId, userId)),
  });
}

export async function updateSourceStatusForUser(input: {
  userId: string;
  sourceId: number;
  status: SourceStatusValue;
}) {
  const source = await findSourceForUser(input.userId, input.sourceId);
  if (!source) {
    return { found: false as const };
  }
  if (!source.active && input.status === "processing") {
    return { found: true as const, conflict: true as const };
  }

  const values =
    input.status === "processing"
      ? { status: input.status, lastError: null, updatedAt: new Date() }
      : { status: input.status, updatedAt: new Date() };

  try {
    await db
      .update(labels)
      .set(values)
      .where(and(eq(labels.id, input.sourceId), eq(labels.userId, input.userId)));
    return { found: true as const, conflict: false as const, fallback: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("no such column") &&
      (message.includes("last_error") || message.includes("active"))
    ) {
      await db
        .update(labels)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(labels.id, input.sourceId), eq(labels.userId, input.userId)));
      return { found: true as const, conflict: false as const, fallback: "legacy-schema" };
    }
    throw error;
  }
}

export async function updateSourceActiveForUser(input: {
  userId: string;
  sourceId: number;
  active: boolean;
}): Promise<
  | { found: false }
  | {
      found: true;
      active: boolean;
      status: SourceStatusValue;
      fallback: string | null;
    }
> {
  const source = await findSourceForUser(input.userId, input.sourceId);
  if (!source) {
    return { found: false as const };
  }

  const nextStatus: SourceStatusValue = input.active
    ? source.status === "complete"
      ? "complete"
      : "queued"
    : source.status === "complete"
      ? "complete"
      : "paused";

  try {
    await db
      .update(labels)
      .set({
        active: input.active,
        status: nextStatus,
        updatedAt: new Date(),
        lastError: input.active ? null : source.lastError,
      })
      .where(and(eq(labels.id, input.sourceId), eq(labels.userId, input.userId)));
    return { found: true as const, active: input.active, status: nextStatus, fallback: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such column") && message.includes("last_error")) {
      await db
        .update(labels)
        .set({
          active: input.active,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(labels.id, input.sourceId), eq(labels.userId, input.userId)));
      return { found: true as const, active: input.active, status: nextStatus, fallback: "legacy-last-error" };
    }
    throw error;
  }
}
