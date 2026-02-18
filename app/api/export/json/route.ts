export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { exportQueueRows } from "@/lib/queries";

export async function GET() {
  const rows = await exportQueueRows();
  return new NextResponse(JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=digqueue-export.json",
    },
  });
}
