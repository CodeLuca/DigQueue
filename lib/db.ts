import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL;
const fallbackDbUrl = "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const postgresDbUrl =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://") ? dbUrl : fallbackDbUrl;

const client = postgres(postgresDbUrl, {
  ssl: "require",
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
