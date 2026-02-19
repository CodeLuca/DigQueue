export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";

const schema = z.object({ active: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentAppUserId();
  const { id } = await params;
  const labelId = Number(id);
  if (!Number.isFinite(labelId) || labelId <= 0) {
    return NextResponse.json({ error: "Invalid label id" }, { status: 400 });
  }

  const payload = schema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), eq(labels.userId, userId)) });
    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const now = new Date();
    const nextStatus = payload.data.active
      ? label.status === "complete"
        ? "complete"
        : "queued"
      : label.status === "complete"
        ? "complete"
        : "paused";

    await db
      .update(labels)
      .set({
        active: payload.data.active,
        status: nextStatus,
        updatedAt: now,
        lastError: payload.data.active ? null : label.lastError,
      })
      .where(and(eq(labels.id, labelId), eq(labels.userId, userId)));

    return NextResponse.json({ ok: true, active: payload.data.active, status: nextStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such column") && message.includes("last_error")) {
      const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), eq(labels.userId, userId)) });
      if (!label) {
        return NextResponse.json({ error: "Label not found" }, { status: 404 });
      }
      const nextStatus = payload.data.active
        ? label.status === "complete"
          ? "complete"
          : "queued"
        : label.status === "complete"
          ? "complete"
          : "paused";
      await db
        .update(labels)
        .set({
          active: payload.data.active,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(labels.id, labelId), eq(labels.userId, userId)));
      return NextResponse.json({ ok: true, active: payload.data.active, status: nextStatus, fallback: "legacy-last-error" });
    }

    return NextResponse.json(
      {
        error: "Failed to toggle label activation",
        detail: message,
        hint: "Run `yarn db:migrate` and restart the dev server.",
      },
      { status: 500 },
    );
  }
}
