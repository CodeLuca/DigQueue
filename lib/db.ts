import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

function isPostgresUrl(value: string | undefined) {
  return Boolean(value && (value.startsWith("postgres://") || value.startsWith("postgresql://")));
}

function resolvePostgresUrl() {
  if (isPostgresUrl(env.SUPABASE_DB_URL)) return env.SUPABASE_DB_URL as string;
  if (isPostgresUrl(env.POSTGRES_URL)) return env.POSTGRES_URL as string;
  if (isPostgresUrl(env.DATABASE_URL)) return env.DATABASE_URL as string;

  // Supabase local Postgres default port.
  return "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

const postgresDbUrl = resolvePostgresUrl();
const useSsl = !postgresDbUrl.includes("127.0.0.1:54322") && !postgresDbUrl.includes("localhost:54322");

const client = postgres(postgresDbUrl, {
  ssl: useSsl ? "require" : false,
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
