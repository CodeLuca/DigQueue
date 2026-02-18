export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";

const schema = z.object({ status: z.enum(["queued", "processing", "paused", "complete", "error"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const labelId = Number(id);
  const payload = schema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  try {
    const label = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }
    if (!label.active && payload.data.status === "processing") {
      return NextResponse.json({ error: "Label is inactive" }, { status: 409 });
    }

    const setValues =
      payload.data.status === "processing"
        ? { status: payload.data.status, lastError: null, updatedAt: new Date() }
        : { status: payload.data.status, updatedAt: new Date() };

    await db.update(labels).set(setValues).where(eq(labels.id, labelId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Backward-compat fallback if DB wasn't migrated yet and lacks newer columns.
    if (
      message.includes("no such column") &&
      (message.includes("last_error") || message.includes("active"))
    ) {
      await db.update(labels).set({ status: payload.data.status, updatedAt: new Date() }).where(eq(labels.id, labelId));
      return NextResponse.json({ ok: true, fallback: "legacy-schema" });
    }

    return NextResponse.json(
      {
        error: "Failed to update label status",
        detail: message,
        hint: "Run `yarn db:migrate` and restart the dev server.",
      },
      { status: 500 },
    );
  }
}
