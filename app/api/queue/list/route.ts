export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { upNext } from "@/lib/processing";

export async function GET(request: Request) {
  const userId = await requireCurrentAppUserId();
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : 24;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.floor(parsedLimit))) : 24;
  const items = await upNext(userId, limit);
  return NextResponse.json({ items });
}
