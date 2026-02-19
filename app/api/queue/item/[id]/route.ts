export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { queueItems } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";

function parseId(value: string) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentAppUserId();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid queue item id." }, { status: 400 });

  await db.delete(queueItems).where(and(eq(queueItems.id, id), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
  return NextResponse.json({ ok: true });
}
