import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getRequiredDatabaseUrl } from "@/lib/db-url";

type DbClient = ReturnType<typeof postgres>;
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __digqueue_pg_client: DbClient | undefined;
  var __digqueue_db: DbInstance | undefined;
}

function getClient() {
  if (globalThis.__digqueue_pg_client) {
    return globalThis.__digqueue_pg_client;
  }

  const client = postgres(getRequiredDatabaseUrl(), {
    ssl: "require",
    prepare: false,
    // Use a small pool to allow query bursts (dashboard tab switches) without
    // exhausting session pooler limits.
    max: 5,
    connect_timeout: 8,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  globalThis.__digqueue_pg_client = client;
  return client;
}

function getDb() {
  if (globalThis.__digqueue_db) {
    return globalThis.__digqueue_db;
  }

  const instance = drizzle(getClient(), { schema });
  globalThis.__digqueue_db = instance;
  return instance;
}

export const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
