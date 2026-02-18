export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDiscogsLabelReleases } from "@/lib/discogs";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid label id" }, { status: 400 });
  }

  const data = await fetchDiscogsLabelReleases(parsed.data.id);
  return NextResponse.json(data);
}
