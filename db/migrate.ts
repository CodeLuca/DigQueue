import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const sqlite = new Database(process.env.DATABASE_URL ?? "./db/digqueue.db");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./db/migrations" });
console.log("Migrations applied.");
