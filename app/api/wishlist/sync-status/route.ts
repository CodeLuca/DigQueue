export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDiscogsWantsSyncStatus } from "@/lib/discogs-wants-sync";

export async function GET() {
  try {
    const status = await getDiscogsWantsSyncStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load wishlist sync status.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

