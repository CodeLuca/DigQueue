export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { processSingleReleaseForLabel } from "@/lib/processing";

const schema = z.object({ labelId: z.number().int().positive() });
let workerBusy = false;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const label = await db.query.labels.findFirst({ where: eq(labels.id, parsed.data.labelId) });
  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  if (!label.active) {
    return NextResponse.json({ done: false, message: "Inactive" });
  }

  if (label.status === "paused") {
    return NextResponse.json({ message: "Paused" });
  }

  if (workerBusy) {
    return NextResponse.json({ done: false, message: "Worker busy" });
  }

  workerBusy = true;
  try {
    const result = await processSingleReleaseForLabel(parsed.data.labelId);
    return NextResponse.json(result);
  } finally {
    workerBusy = false;
  }
}
