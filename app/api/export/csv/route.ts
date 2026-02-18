export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { exportQueueRows } from "@/lib/queries";

function toCsv(rows: Awaited<ReturnType<typeof exportQueueRows>>) {
  const headers = ["id", "status", "youtubeVideoId", "trackTitle", "releaseTitle", "labelName", "addedAt"];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((key) => {
      const value = row[key as keyof typeof row];
      return `"${String(value ?? "").replaceAll('"', '""')}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

export async function GET() {
  const rows = await exportQueueRows();
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=digqueue-export.csv",
    },
  });
}
