export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDiscogsRelease, fetchDiscogsReleaseMarketStats } from "@/lib/discogs";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
  }
  try {
    const [release, marketStats] = await Promise.all([
      fetchDiscogsRelease(parsed.data.id),
      fetchDiscogsReleaseMarketStats(parsed.data.id).catch(() => null),
    ]);
    return NextResponse.json({ ...release, marketStats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Discogs release.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
