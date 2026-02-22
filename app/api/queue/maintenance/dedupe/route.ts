export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { dedupePendingQueueItems } from "@/lib/queue-maintenance";

const schema = z
  .object({
    trackId: z.number().int().positive().optional(),
  })
  .optional();

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await dedupePendingQueueItems(userId, {
    trackId: parsed.data?.trackId,
  });
  return NextResponse.json({ ok: true, ...result });
}

