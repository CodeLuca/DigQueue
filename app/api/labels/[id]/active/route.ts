export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";

const schema = z.object({ active: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const labelId = Number(id);
  if (!Number.isFinite(labelId) || labelId <= 0) {
    return NextResponse.json({ error: "Invalid label id" }, { status: 400 });
  }

  const payload = schema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const label = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
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
    .where(eq(labels.id, labelId));

  return NextResponse.json({ ok: true, active: payload.data.active, status: nextStatus });
}
