import fs from "node:fs";
import path from "node:path";

function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

let devDotenvDbUrlCache: string | null | undefined;

function readDevSupabaseDbUrlFromDotenvLocal(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  if (devDotenvDbUrlCache !== undefined) return devDotenvDbUrlCache ?? undefined;

  try {
    const envLocalPath = path.join(process.cwd(), ".env.local");
    const raw = fs.readFileSync(envLocalPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      if (key !== "SUPABASE_DB_URL") continue;
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      devDotenvDbUrlCache = value || null;
      return value || undefined;
    }
  } catch {
    // Ignore local dotenv parsing issues and fall back to process.env.
  }

  devDotenvDbUrlCache = null;
  return undefined;
}

export function resolveDatabaseUrl() {
  const devDotenvUrl = readDevSupabaseDbUrlFromDotenvLocal();
  const url =
    devDotenvUrl ??
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL;

  if (!url) {
    return undefined;
  }

  if (!isPostgresUrl(url)) {
    throw new Error(
      "Database URL must be a postgres connection string via SUPABASE_DB_URL/POSTGRES_URL/DATABASE_URL.",
    );
  }

  return url;
}

export function getRequiredDatabaseUrl() {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing database URL. Set SUPABASE_DB_URL (preferred) or POSTGRES_URL/DATABASE_URL to a Supabase Postgres connection string.",
    );
  }
  return url;
}
