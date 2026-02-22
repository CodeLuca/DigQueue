export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDiscogsWantsSyncStatus, syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";

export async function POST() {
  try {
    await syncDiscogsWantsToLocal({ force: false, maxItems: 200 });
    const status = await getDiscogsWantsSyncStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run auto wishlist sync.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

