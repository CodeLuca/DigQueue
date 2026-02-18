import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const sqlite = new Database(env.DATABASE_URL, { timeout: 5000 });
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
