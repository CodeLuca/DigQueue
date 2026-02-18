export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { upNext } from "@/lib/processing";

export async function GET(request: Request) {
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : 24;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.floor(parsedLimit))) : 24;
  const items = await upNext(limit);
  return NextResponse.json({ items });
}

