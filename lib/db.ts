import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const dbUrl = env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL;
if (!dbUrl || (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://"))) {
  throw new Error("Database URL must be a postgres connection string via SUPABASE_DB_URL/POSTGRES_URL/DATABASE_URL.");
}

const postgresDbUrl = dbUrl;
const useSsl = true;

type DbClient = ReturnType<typeof postgres>;
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __digqueue_pg_client: DbClient | undefined;
  // eslint-disable-next-line no-var
  var __digqueue_db: DbInstance | undefined;
}

const client =
  globalThis.__digqueue_pg_client ??
  postgres(postgresDbUrl, {
    ssl: useSsl ? "require" : false,
    prepare: false,
    // Use a small pool to allow query bursts (dashboard tab switches) without
    // exhausting session pooler limits.
    max: 5,
    connect_timeout: 8,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

if (!globalThis.__digqueue_pg_client) {
  globalThis.__digqueue_pg_client = client;
}

export const db = globalThis.__digqueue_db ?? drizzle(client, { schema });
if (!globalThis.__digqueue_db) {
  globalThis.__digqueue_db = db;
}
