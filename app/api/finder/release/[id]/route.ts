export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { findReleaseLinks } from "@/lib/finder";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
  }

  try {
    const links = await findReleaseLinks(parsed.data.id);
    return NextResponse.json(links);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Finder failed" }, { status: 500 });
  }
}
