export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { labels } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { fetchDiscogsRelease } from "@/lib/discogs";
import { toStoredDiscogsId } from "@/lib/discogs-id";
import { refreshLabelMetadata } from "@/lib/label-metadata";

const schema = z.object({
  releaseId: z.number().int().positive(),
});

function parseLabelIdFromResourceUrl(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\/labels?\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const release = await fetchDiscogsRelease(parsed.data.releaseId);
  const label = (release.labels ?? []).find((item) => typeof item?.id === "number" || item?.resource_url);
  const externalLabelId = typeof label?.id === "number" ? label.id : parseLabelIdFromResourceUrl(label?.resource_url);
  if (!externalLabelId) {
    return NextResponse.json({ error: "No label metadata found for release." }, { status: 404 });
  }
  const labelId = toStoredDiscogsId(userId, externalLabelId, "label");

  const now = new Date();
  await db
    .insert(labels)
    .values({
      id: labelId,
      userId,
      name: label?.name?.trim() || `Label ${externalLabelId}`,
      discogsUrl: `https://www.discogs.com/label/${externalLabelId}`,
      sourceType: "workspace",
      active: true,
      status: "queued",
      currentPage: 1,
      totalPages: 1,
      retryCount: 0,
      lastError: null,
      addedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: labels.id,
      set: {
        name: label?.name?.trim() || `Label ${externalLabelId}`,
        discogsUrl: `https://www.discogs.com/label/${externalLabelId}`,
        sourceType: "workspace",
        active: true,
        updatedAt: now,
        status: "queued",
        lastError: null,
      },
    });

  try {
    await refreshLabelMetadata(labelId, userId);
  } catch {
    // Non-blocking: label creation should succeed even if metadata lookup fails.
  }

  return NextResponse.json({ ok: true, labelId });
}
