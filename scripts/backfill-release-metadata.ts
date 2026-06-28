import { loadEnvConfig } from "@next/env";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { releases } from "@/db/schema";
import { db } from "@/lib/db";
import type { DiscogsRelease } from "@/lib/discogs";
import { toExternalDiscogsId } from "@/lib/discogs-id";
import { deriveReleaseMetadataFromDiscogs, needsReleaseMetadataRepair } from "@/lib/release-metadata";

loadEnvConfig(process.cwd());

const DISCOGS_API = "https://api.discogs.com";
const DISCOGS_MIN_CALL_GAP_MS = 1200;
const DISCOGS_MAX_RETRIES = 4;

type ReleaseRow = typeof releases.$inferSelect;
type ReleasePatch = Partial<Pick<ReleaseRow, "artist" | "catno" | "thumbUrl" | "title" | "year">>;

function parseArgs(argv: string[]) {
  const args = {
    apply: false,
    limit: 50,
    userId: null as string | null,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) args.limit = Math.floor(value);
      continue;
    }
    if (arg.startsWith("--user=")) {
      const value = arg.slice("--user=".length).trim();
      args.userId = value || null;
    }
  }

  return args;
}

function cleanText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || null;
}

function isUnknownArtist(value: string | null | undefined) {
  return !cleanText(value) || cleanText(value) === "Unknown Artist";
}

function isPlaceholderTitle(value: string | null | undefined) {
  const title = cleanText(value);
  return !title || /^release\s+\d+$/i.test(title);
}

function buildSafePatch(row: ReleaseRow, candidate: ReleasePatch) {
  const patch: ReleasePatch = {};

  if (isUnknownArtist(row.artist) && !isUnknownArtist(candidate.artist)) {
    patch.artist = cleanText(candidate.artist)!;
  }
  if (isPlaceholderTitle(row.title) && cleanText(candidate.title)) {
    patch.title = cleanText(candidate.title)!;
  }
  if (!cleanText(row.catno) && cleanText(candidate.catno)) {
    patch.catno = cleanText(candidate.catno);
  }
  if (!cleanText(row.thumbUrl) && cleanText(candidate.thumbUrl)) {
    patch.thumbUrl = cleanText(candidate.thumbUrl);
  }
  if (row.year == null && typeof candidate.year === "number" && Number.isFinite(candidate.year) && candidate.year > 0) {
    patch.year = candidate.year;
  }

  return patch;
}

function patchEntries(patch: ReleasePatch) {
  return Object.entries(patch).filter(([, value]) => value !== undefined);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

let lastDiscogsCall = 0;

async function fetchDiscogsReleaseForScript(releaseId: number): Promise<DiscogsRelease> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) {
    throw new Error("DISCOGS_TOKEN is required for standalone metadata backfill.");
  }

  const externalReleaseId = toExternalDiscogsId(releaseId);
  const gap = Date.now() - lastDiscogsCall;
  const wait = Math.max(0, DISCOGS_MIN_CALL_GAP_MS - gap);
  if (wait > 0) await sleep(wait);

  let attempt = 0;
  while (attempt < DISCOGS_MAX_RETRIES) {
    const response = await fetch(`${DISCOGS_API}/releases/${externalReleaseId}`, {
      headers: {
        Authorization: `Discogs token=${token}`,
        "User-Agent": "DigQueueMetadataBackfill/1.0",
      },
    });
    lastDiscogsCall = Date.now();

    if (response.ok) {
      return (await response.json()) as DiscogsRelease;
    }
    if (response.status === 429 || response.status >= 500) {
      attempt += 1;
      await sleep(1250 * 2 ** attempt);
      continue;
    }

    const body = await response.text();
    throw new Error(`Discogs error ${response.status}: ${body}`);
  }

  throw new Error("Discogs rate limit retries exhausted.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const where = and(
    eq(releases.detailsFetched, true),
    args.userId ? eq(releases.userId, args.userId) : undefined,
    or(
      eq(releases.artist, "Unknown Artist"),
      isNull(releases.catno),
      isNull(releases.thumbUrl),
      isNull(releases.year),
    ),
  );

  const rows = await db
    .select()
    .from(releases)
    .where(where)
    .orderBy(asc(releases.fetchedAt))
    .limit(args.limit);

  const stats = {
    checked: 0,
    changed: 0,
    errors: 0,
    fields: new Map<string, number>(),
  };
  const samples: Array<{ id: number; title: string; fields: string[] }> = [];

  for (const row of rows) {
    if (!needsReleaseMetadataRepair(row)) continue;
    stats.checked += 1;

    try {
      const details = await fetchDiscogsReleaseForScript(row.id);
      const candidate = deriveReleaseMetadataFromDiscogs(details, { artist: row.artist, title: row.title });
      const patch = buildSafePatch(row, candidate);
      const entries = patchEntries(patch);
      if (entries.length === 0) continue;

      stats.changed += 1;
      for (const [field] of entries) {
        stats.fields.set(field, (stats.fields.get(field) ?? 0) + 1);
      }
      if (samples.length < 8) {
        samples.push({ id: row.id, title: row.title, fields: entries.map(([field]) => field) });
      }

      if (args.apply) {
        await db.update(releases).set(patch).where(eq(releases.id, row.id));
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`release ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(JSON.stringify({
    mode: args.apply ? "apply" : "dry-run",
    selected: rows.length,
    checked: stats.checked,
    changed: stats.changed,
    errors: stats.errors,
    fields: Object.fromEntries(stats.fields),
    samples,
  }, null, 2));
}

async function closeDbClient() {
  const client = (globalThis as typeof globalThis & {
    __digqueue_pg_client?: { end: (options?: { timeout?: number }) => Promise<void> };
  }).__digqueue_pg_client;
  await client?.end({ timeout: 5 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDbClient);
