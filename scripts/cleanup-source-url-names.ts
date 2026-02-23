import { eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";

function parseNameSlug(urlLike: string) {
  try {
    const parsed = new URL(urlLike);
    const match = parsed.pathname.match(/\/(?:label|artist)\/\d+-([^/?#]+)/i);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]).replace(/[-_]+/g, " ").trim();
    return slug || null;
  } catch {
    return null;
  }
}

function deriveNameFromSources(input: { name: string; discogsUrl: string; kind: "label" | "artist"; fallbackId?: number }) {
  const { name, discogsUrl, kind, fallbackId } = input;
  const fallback = `${kind === "artist" ? "Artist" : "Label"}${fallbackId ? ` ${fallbackId}` : ""}`;
  if (/^https?:\/\//i.test(name)) {
    const fromName = parseNameSlug(name);
    if (fromName) return fromName;
  }
  const fromDiscogsUrl = parseNameSlug(discogsUrl);
  if (fromDiscogsUrl) return fromDiscogsUrl;
  return fallback;
}

async function fetchCanonicalDiscogsName(kind: "label" | "artist", id: number) {
  if (!id) return null;
  const token = process.env.DISCOGS_TOKEN?.trim();
  const endpoint = kind === "artist" ? "artists" : "labels";
  const response = await fetch(`https://api.discogs.com/${endpoint}/${id}`, {
    headers: {
      ...(token ? { Authorization: `Discogs token=${token}` } : {}),
      "User-Agent": "DigQueue/0.1 (+https://digqueue.app)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  return name || null;
}

async function run() {
  const rows = await db.query.labels.findMany({
    columns: {
      id: true,
      name: true,
      discogsUrl: true,
      entityKind: true,
    },
  });

  const candidates = rows.filter((row) => /^https?:\/\//i.test(row.name) || /^(?:Label|Artist)\s+\d+$/i.test(row.name));

  if (candidates.length === 0) {
    console.log("No URL-like source names found.");
    return;
  }

  let updated = 0;
  for (const row of candidates) {
    const kind = row.entityKind === "artist" ? "artist" : "label";
    const parsedExternalId = Number(row.discogsUrl.match(/\/(?:label|artist)\/(\d+)/i)?.[1] || 0);
    const nextName = deriveNameFromSources({
      name: row.name,
      discogsUrl: row.discogsUrl,
      kind,
      fallbackId: Number.isFinite(parsedExternalId) ? parsedExternalId : undefined,
    });
    const normalizedFallback = `${kind === "artist" ? "Artist" : "Label"} ${parsedExternalId}`.trim();
    const resolvedName =
      nextName === normalizedFallback
        ? (await fetchCanonicalDiscogsName(kind, parsedExternalId)) || nextName
        : nextName;
    if (!resolvedName || resolvedName === row.name) continue;

    await db.update(labels).set({ name: resolvedName }).where(eq(labels.id, row.id));
    updated += 1;
    console.log(`Updated ${row.id}: "${row.name}" -> "${resolvedName}"`);
  }

  console.log(`Done. Updated ${updated}/${candidates.length} source names.`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  });
