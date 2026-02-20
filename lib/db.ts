import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const postgresDbUrl =
  "postgresql://postgres.ddjgidcjaqnybuhzwmue:Bakedbeanas2001!@aws-0-eu-west-2.pooler.supabase.com:5432/postgres";
const useSsl = true;

const client = postgres(postgresDbUrl, {
  ssl: useSsl ? "require" : false,
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
