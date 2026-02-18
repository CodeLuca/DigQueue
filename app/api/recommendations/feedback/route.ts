export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { logFeedbackEvent } from "@/lib/recommendations";

const schema = z.object({
  trackId: z.number().int().positive().optional(),
  releaseId: z.number().int().positive().optional(),
  eventType: z.enum(["dismiss"]),
}).refine((value) => typeof value.trackId === "number" || typeof value.releaseId === "number", {
  message: "trackId or releaseId is required",
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await logFeedbackEvent({
    eventType: parsed.data.eventType,
    source: "api_recommendations_feedback",
    trackId: parsed.data.trackId ?? null,
    releaseId: parsed.data.releaseId ?? null,
  });

  return NextResponse.json({ ok: true });
}
